// import { ChatAnthropic } from "@langchain/anthropic"
// import wxflows from "@wxflows/sdk/langchain"
// import { ToolNode } from "@langchain/langgraph/prebuilt"
// import {
//   MessagesAnnotation,
//   START,
//   END,
//   StateGraph,
//   MemorySaver,
// } from "@langchain/langgraph"
// import SYSTEM_MESSAGE from "@/constants/systemMessage"
// import {
//   ChatPromptTemplate,
//   MessagesPlaceholder,
// } from "@langchain/core/prompts"
// import {
//   AIMessage,
//   BaseMessage,
//   HumanMessage,
//   SystemMessage,
//   trimMessages,
// } from "@langchain/core/messages"
// import { threadId } from "worker_threads"

// // Customers at : https://introspection.apis.stepzen.com/customers
// // Comments at : https://dummyjson.com/comments

// // trim the message to manage conversation context
// const trimmer = trimMessages({
//   maxTokens: 10, // last 10 messages
//   strategy: "last",
//   tokenCounter: (msgs) => msgs.length,
//   includeSystem: true,
//   allowPartial: false,
//   startOn: "human",
// }) // more on docs:

// // Connect to WXflow for tools
// // wxflows requires an endpoint and apikey
// const toolClient = new wxflows({
//   endpoint: process.env.WXFLOWS_ENDPOINT || "",
//   apikey: process.env.WXFLOWS_APIKEY,
// })

// // Retrieve the tools from the client
// const tools = await toolClient.lcTools
// // Create toolNode from tools
// const toolNode = new ToolNode(tools)

// const initialiseModel = () => {
//   const model = new ChatAnthropic({
//     model: "claude-3-5-sonnet-20240620",
//     temperature: 0.7, // Higher temperature means more creative responses
//     maxTokens: 4096, // Set the maximum number of tokens
//     streaming: true, // Enable streaming for SSE
//     clientOptions: {
//       defaultHeaders: {
//         "anthropic-beta": "prompt-caching-2024-07-31",
//       },
//     },
//     callbacks: [
//       {
//         handleLLMNewToken(token) {
//           console.log("LLM Start, token:", token)
//         },
//       },
//       {
//         handleLLMEnd(output) {
//           console.log("LLM End, output:", output)
//         },
//       },
//     ],
//   }).bindTools(tools) // Pass the tools array, not toolNode

//   return model
// }

// // Define the function that determines whether to continue or not

// function shouldContinue(state: typeof MessagesAnnotation.State) {
//   const messages = state.messages
//   const lastMessage = messages[messages.length - 1] as AIMessage

//   //If the LLM makes a tool call, then we route to the "tools" node
//   if (lastMessage.tool_calls?.length) {
//     return "tools"
//   }

//   // If the last message is a tool message, route back to agent
//   if (lastMessage.content && lastMessage._getType() == "tool") return "agent"

//   // Otherwise, continue/END reply to user
//   return END
// }

// // Workflow for Langraph
// const createWorkflow = () => {
//   const model = initialiseModel()

//   // Graph of flow for Langgraph for agent to use
//   const stateGraph = new StateGraph(MessagesAnnotation)
//     .addNode("agent", async (state) => {
//       // Create the system message
//       const systemMessage = SYSTEM_MESSAGE

//       // Create the prompt template with system message and message placeholder
//       const promptTemplate = ChatPromptTemplate.fromMessages([
//         new SystemMessage(systemMessage, {
//           cache_control: {
//             type: "ephemeral", // set the cache control to ephemeral for system message
//           },
//         }),
//         new MessagesPlaceholder("messages"), // placeholder for all previous messages and new message as array
//       ])

//       // Trim the message to manage conversation context
//       const trimmedMessage = await trimmer.invoke(state.messages)

//       // Format the prompt with current messages in to the placeholder of promptTemplate
//       const prompt = await promptTemplate.invoke({ messages: trimmedMessage })

//       // Get response from model
//       const response = await model.invoke(prompt)

//       return { messages: [response] }
//     })
//     .addEdge(START, "agent") // start with agent
//     .addNode("tools", toolNode) // check if agent wants to use tools
//     .addConditionalEdges("agent", shouldContinue) // check if agent wants to continue
//     .addEdge("tools", "agent") // if agent wants to use tools, go to agent

//   return stateGraph
// }

// function addCachingHeaders(messages: BaseMessage[]): BaseMessage[] {
//   // Rule of caching headers for turn-by-turn conversation
//   // 1. Cache the first SYSTEM MESSAGE - already done on the promptTemplate above
//   // 2. Cache the LAST message
//   // 3. Cache the SECOND to LAST human message

//   if (!messages.length) return messages

//   // Create a copy of message to avoide mutating th original array
//   const cachedMessages = [...messages]

//   // Helper to add cache control
//   const addCache = (message: BaseMessage) => {
//     message.content = [
//       {
//         type: "text",
//         content: message.content as string,
//         cache_control: { type: "ephemeral" },
//       },
//     ]
//   }

//   //2. Cache the last message
//   addCache(cachedMessages[cachedMessages.length - 1])

//   //3. Cache the second to last  human message
//   let humanCount = 0
//   for (let i = cachedMessages.length - 1; i >= 0; i--) {
//     if (cachedMessages[i] instanceof HumanMessage) {
//       humanCount++
//       if (humanCount === 2) {
//         addCache(cachedMessages[i])
//         break
//       }
//     }
//   }

//   return cachedMessages
// }

// export async function submitQuestion(messages: BaseMessage[], chatId: string) {
//   // Add caching headers to messages
//   const cachedMessages = addCachingHeaders(messages)

//   console.log("cachedMessages", cachedMessages)

//   // Create the workflow
//   const workflow = createWorkflow()

//   // Create a checkpoint to save the state of the conversation
//   const checkpointer = new MemorySaver()
//   const app = workflow.compile({ checkpointer })

//   // Run the graph and stream
//   const stream = await app.streamEvents(
//     { messages },
//     {
//       version: "v2",
//       configurable: { threadId: chatId }, // pass the chatId as the threadId to make that conversation unique for the llm to remember from others conversations
//       streamMode: "messages",
//       runId: chatId,
//     }
//   )

//   return stream
// }

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages"
import { ChatAnthropic } from "@langchain/anthropic"
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph"
import { MemorySaver } from "@langchain/langgraph"
import { ToolNode } from "@langchain/langgraph/prebuilt"
import wxflows from "@wxflows/sdk/langchain"
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts"
import SYSTEM_MESSAGE from "@/constants/systemMessage"

// Trim the messages to manage conversation history
const trimmer = trimMessages({
  maxTokens: 10,
  strategy: "last",
  tokenCounter: (msgs) => msgs.length,
  includeSystem: true,
  allowPartial: false,
  startOn: "human",
})

// Connect to wxflows
const toolClient = new wxflows({
  endpoint: process.env.WXFLOWS_ENDPOINT || "",
  apikey: process.env.WXFLOWS_APIKEY,
})

// Retrieve the tools
const tools = await toolClient.lcTools
const toolNode = new ToolNode(tools)

// Connect to the LLM provider with better tool instructions
const initialiseModel = () => {
  const model = new ChatAnthropic({
    model: "claude-3-5-sonnet-20240620",
    // modelName: "claude-3-5-sonnet-20241022",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
    clientOptions: {
      defaultHeaders: {
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
    },
    callbacks: [
      {
        handleLLMStart: async () => {
          // console.log("🤖 Starting LLM call");
        },
        handleLLMEnd: async (output) => {
          console.log("🤖 End LLM call", output)
          const usage = output.llmOutput?.usage
          if (usage) {
            // console.log("📊 Token Usage:", {
            //   input_tokens: usage.input_tokens,
            //   output_tokens: usage.output_tokens,
            //   total_tokens: usage.input_tokens + usage.output_tokens,
            //   cache_creation_input_tokens:
            //     usage.cache_creation_input_tokens || 0,
            //   cache_read_input_tokens: usage.cache_read_input_tokens || 0,
            // });
          }
        },
        // handleLLMNewToken: async (token: string) => {
        //   // console.log("🔤 New token:", token);
        // },
      },
    ],
  }).bindTools(tools)

  return model
}

// Define the function that determines whether to continue or not
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const messages = state.messages
  const lastMessage = messages[messages.length - 1] as AIMessage

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools"
  }

  // If the last message is a tool message, route back to agent
  if (lastMessage.content && lastMessage._getType() === "tool") {
    return "agent"
  }

  // Otherwise, we stop (reply to the user)
  return END
}

// Define a new graph
const createWorkflow = () => {
  const model = initialiseModel()

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      // Create the system message content
      const systemContent = SYSTEM_MESSAGE

      // Create the prompt template with system message and messages placeholder
      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemContent, {
          cache_control: { type: "ephemeral" },
        }),
        new MessagesPlaceholder("messages"),
      ])

      // Trim the messages to manage conversation history
      const trimmedMessages = await trimmer.invoke(state.messages)

      // Format the prompt with the current messages
      const prompt = await promptTemplate.invoke({ messages: trimmedMessages })

      // Get response from the model
      const response = await model.invoke(prompt)

      return { messages: [response] }
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
}

function addCachingHeaders(messages: BaseMessage[]): BaseMessage[] {
  if (!messages.length) return messages

  // Create a copy of messages to avoid mutating the original
  const cachedMessages = [...messages]

  // Helper to add cache control
  const addCache = (message: BaseMessage) => {
    message.content = [
      {
        type: "text",
        text: message.content as string,
        cache_control: { type: "ephemeral" },
      },
    ]
  }

  // Cache the last message
  // console.log("🤑🤑🤑 Caching last message");
  addCache(cachedMessages.at(-1)!)

  // Find and cache the second-to-last human message
  let humanCount = 0
  for (let i = cachedMessages.length - 1; i >= 0; i--) {
    if (cachedMessages[i] instanceof HumanMessage) {
      humanCount++
      if (humanCount === 2) {
        // console.log("🤑🤑🤑 Caching second-to-last human message");
        addCache(cachedMessages[i])
        break
      }
    }
  }

  return cachedMessages
}

export async function submitQuestion(messages: BaseMessage[], chatId: string) {
  // Add caching headers to messages
  const cachedMessages = addCachingHeaders(messages)
  // console.log("🔒🔒🔒 Messages:", cachedMessages);

  // Create workflow with chatId and onToken callback
  const workflow = createWorkflow()

  // Create a checkpoint to save the state of the conversation
  const checkpointer = new MemorySaver()
  const app = workflow.compile({ checkpointer })

  const stream = await app.streamEvents(
    { messages: cachedMessages },
    {
      version: "v2",
      configurable: { thread_id: chatId },
      streamMode: "messages",
      runId: chatId,
    }
  )
  return stream
}
