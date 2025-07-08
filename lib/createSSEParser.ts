import {
  SSE_DONE_MESSAGE,
  StreamMessageType,
  SSE_DATA_PREFIX,
  StreamMessage,
} from "./types"

export const createSSEParser = () => {
  let buffer = ""
  const parse = (chunk: string): StreamMessage[] => {
    // Combine buffer with new chunk and split into lines
    const lines = (buffer + chunk).split("\n")

    // Save last potentially incomplete like
    buffer = lines.pop() || ""

    return lines
      .map((line) => {
        const trimmedLine = line.trim()
        if (!trimmedLine || !trimmedLine.startsWith(SSE_DATA_PREFIX)) {
          return null
        }

        // Get data from line
        const data = trimmedLine.substring(SSE_DATA_PREFIX.length)

        if (data === SSE_DONE_MESSAGE) {
          return { type: StreamMessageType.Done }
        }

        try {
          const parsed = JSON.parse(data) as StreamMessage
          return Object.values(StreamMessageType).includes(parsed.type)
            ? parsed
            : null
        } catch {
          return {
            type: StreamMessageType.Error,
            error: "Failed to parse data",
          }
        }
      })
      .filter((msg): msg is StreamMessage => msg !== null) // last check/filter for lines that are not StreamMessages
  }

  return {
    parse,
  }
}
