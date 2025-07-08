import { api } from "@/convex/_generated/api"
import { getConvexClient } from "@/lib/convex"
import { submitQuestion } from "@/lib/langgraph"
import {
  ChatRequestBody,
  SSE_DATA_PREFIX,
  SSE_LINE_DELIMITER,
  StreamMessage,
  StreamMessageType,
} from "@/lib/types"
import { auth } from "@clerk/nextjs/server"
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages"
import { NextResponse } from "next/server"

// Helper function to send SSE messages
const sendSSEMessage = async (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  data: StreamMessage
) => {
  const encoder = new TextEncoder()
  return writer.write(
    encoder.encode(
      `${SSE_DATA_PREFIX}${JSON.stringify(data)}${SSE_LINE_DELIMITER}`
    )
  )
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response("Unauthorized in chat stream API", { status: 401 })
    }
    const body = (await req.json()) as ChatRequestBody

    const { messages, newMessage, chatId } = body

    const convex = getConvexClient()

    // Create stream with larger queue strategy for better performance
    const stream = new TransformStream({}, { highWaterMark: 1024 })
    const writer = stream.writable.getWriter() // Get writable stream
    // Establish SSE connection
    const response = new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering for nginx which is required for SSE to work properly
      },
    })
    // Start streaming response
    const startStream = async () => {
      try {
        // stream will be implemented here
        // Send the first message: Connection established
        await sendSSEMessage(writer, {
          type: StreamMessageType.Connected,
        })

        // Send user message to Convex
        await convex.mutation(api.messages.send, {
          chatId,
          content: newMessage,
        })

        // Convert all the messages to lanchain messages: BaseMessage[]

        const lanchainMessages = [
          ...messages.map((msg) =>
            msg.role === "user"
              ? new HumanMessage(msg.content)
              : new AIMessage(msg.content)
          ),
          new HumanMessage(newMessage),
        ]

        // Stream the response from Convex
        try {
          // create the event stream
          const eventStream = await submitQuestion(lanchainMessages, chatId)
          // Process the events
          for await (const event of eventStream) {
            console.log("Event: ", event)

            // Process the event for stream response
            if (event.event === "on_chat_model_stream") {
              // any new chunk
              const token = event.data.chunk
              if (token) {
                // Access the text property from the AIMessage Chunk
                const text = token.content.at(0)?.text

                if (text) {
                  await sendSSEMessage(writer, {
                    type: StreamMessageType.Token,
                    token: text,
                  })
                }
              }
            } else if (event.event === "on_tool_start") {
              await sendSSEMessage(writer, {
                type: StreamMessageType.ToolStart,
                tool: event.name || "unknown",
                input: event.data.input,
              })
            } else if (event.event === "on_tool_end") {
              // Get the tool end message
              const toolMessage = new ToolMessage(event.data.output)
              // Send the tool end message
              await sendSSEMessage(writer, {
                type: StreamMessageType.ToolEnd,
                tool: toolMessage.lc_kwargs.name || "unknown",
                output: event.data.output,
              })
            }
          }
          // Send the completion message: without storing the response
          await sendSSEMessage(writer, {
            type: StreamMessageType.Done,
          })
        } catch (streamError) {
          console.error(
            "🔥 Error in event stream API in submitQuestion:",
            streamError
          )
          await sendSSEMessage(writer, {
            type: StreamMessageType.Error,
            error: `Failed to process chat request: ${streamError}`,
          })
          return
        }
      } catch (error) {
        console.error("🔥 Error in stream API:", error)
        return NextResponse.json(
          { error: "Failed to process chat request" },
          { status: 500 }
        )
      } finally {
        // Close the stream
        try {
          await writer.close()
        } catch (closeError) {
          console.error("🔥 Error closing writer:", closeError)
        }
      }
    }

    startStream()

    return response
  } catch (error) {
    console.error("🔥 Error in chat stream API:", error)
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    )
  }
}
