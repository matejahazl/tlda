// The contract between LlmProvider and each provider: our own neutral format,
// which every provider maps to and from its wire format.

export type LlmUsage = { inputTokens?: number; outputTokens?: number } // token counts, shared by complete() and chat()

// complete(): one prompt in, one text reply out

export type CompleteRequest = {
    system: string // instructions
    user: string // the input, e.g. the notes
    responseSchema?: Record<string, unknown> // asks for a JSON reply of this shape
    maxOutputTokens?: number
}

export type CompleteResponse = {
    text: string
    usage?: LlmUsage
}

// chat(): one turn of a tool-using conversation

export type ChatRequest = {
    system: string
    messages: AgentMessage[]
    tools: ToolDeclaration[]
    maxOutputTokens?: number // per turn
}

export type ChatResponse = {
    reply:
        | { kind: "text"; text: string }
        | { kind: "tool_calls"; calls: ToolCall[] }
    raw: string // the provider's response body, verbatim, for the log
    usage?: LlmUsage
}

export type AgentMessage =
    | { role: "user"; text: string }
    | { role: "model"; calls: ToolCall[] }
    | { role: "tool"; results: ToolResult[] }

export type ToolDeclaration = {
    name: string
    description: string
    parameters: Record<string, unknown> // JSON schema
}

// runAgent checks args with the tool's zod schema
export type ToolCall = {
    id: string
    name: string
    args: unknown
    signature?: string // opaque, sent back unchanged (e.g. Gemini's thought signature)
}

export type ToolResult = { id: string; name: string; result: unknown }
