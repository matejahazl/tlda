import type { z } from "zod"
import type { AskSource, llmOutputSchema } from "@/lib/shared"

export type ProviderFailureReason =
    "timeout" | "provider_unavailable" | "provider_error"

export type CompleteRequest = {
    system: string // instructions
    user: string // the input, e.g. the notes
    responseSchema?: Record<string, unknown> // a standard JSON schema; asks for a JSON reply of this shape
    maxOutputTokens?: number
}

export type LlmUsage = { inputTokens?: number; outputTokens?: number } // token counts, shared by complete() and chat()

export type CompleteResponse = {
    text: string
    usage?: LlmUsage
}

export type Extraction = z.output<typeof llmOutputSchema>

export type FailureReason =
    ProviderFailureReason | "not_json" | "schema_mismatch" | "prose"

// Never throws: the caller logs the outcome (including the raw response) and decides the error
export type ExtractionResult =
    | { ok: true; extraction: Extraction; response: CompleteResponse }
    | {
          ok: false
          reason: FailureReason
          response?: CompleteResponse // missing when the call failed before a reply
          cause?: unknown // the provider error, for the log only
      }

// A tool as the model sees it
export type ToolDecl = {
    name: string
    description: string
    parameters: Record<string, unknown>
}

// sources: the meetings this result came from;
// rows: how many rows it holds, for the log
export type ToolOutput = { result: unknown; sources: AskSource[]; rows: number }

// A tool as runAgent runs it. The caller (AskService) owns the handlers, so runAgent does no DB work.
export type AgentTool<Args extends z.ZodType = z.ZodType> = {
    name: string
    description: string
    args: Args
    handler(args: z.output<Args>): ToolOutput
}

// runAgent validates args with the tool's zod schema
export type ToolCall = {
    id: string
    name: string
    args: unknown
    signature?: string
}

export type ToolResult = { id: string; name: string; result: unknown }

// Our own conversation format; each provider maps it to its wire format
export type AgentMessage =
    | { role: "user"; text: string }
    | { role: "model"; calls: ToolCall[] }
    | { role: "tool"; results: ToolResult[] }

export type ChatRequest = {
    system: string
    messages: AgentMessage[]
    tools: ToolDecl[]
    maxOutputTokens?: number // per turn
}

export type ChatResponse = {
    reply:
        | { kind: "text"; text: string }
        | { kind: "tool_calls"; calls: ToolCall[] }
    raw: string // the provider's response body, verbatim, for the log
    usage?: LlmUsage
}

export type AgentFailureReason =
    ProviderFailureReason | "bad_answer" | "tool_error" | "max_turns"

export type ToolCallTrace = {
    name: string
    args: unknown
    ok: boolean
    rows: number
    durationMs: number
}

// What the caller logs for every ask outcome
export type AgentTrace = {
    toolCalls: ToolCallTrace[]
    responses: string[] // each raw provider response, verbatim
}

type AgentRun = {
    trace: AgentTrace
    usage: { inputTokens: number; outputTokens: number } // summed over all turns
    turns: number
}

export type AgentResult =
    | ({ ok: true; answer: string; sources: AskSource[] } & AgentRun)
    | ({
          ok: false
          reason: AgentFailureReason
          cause?: unknown // the provider error, for the log only
      } & AgentRun)
