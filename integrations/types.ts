import type { z } from "zod"
import type { llmOutputSchema } from "@/lib/schemas"
import type { AskSource } from "@/types"

// Providers only make the HTTP call. Prompt, parsing, validation and the timeout live in LlmIntegrationService.
export interface LlmProvider {
    complete(
        request: LlmRequest,
        opts: { signal: AbortSignal },
    ): Promise<LlmResponse>

    // one turn of a tool-using conversation (used by the ask agent only)
    chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse>
}

export type ProviderFailureReason =
    "timeout" | "provider_unavailable" | "provider_error"

export type LlmRequest = {
    system: string // instructions
    user: string // the notes
}

export type LlmResponse = {
    text: string
    usage?: { inputTokens?: number; outputTokens?: number }
}

export type Extraction = z.output<typeof llmOutputSchema>

export type FailureReason =
    ProviderFailureReason | "not_json" | "schema_mismatch" | "prose"

// Never throws: the caller logs the outcome (including the raw response) and decides the error
export type ExtractionResult =
    | { ok: true; extraction: Extraction; response: LlmResponse }
    | {
          ok: false
          reason: FailureReason
          response?: LlmResponse // missing when the call failed before a reply
          cause?: unknown // the provider error, for the log only
      }

// A tool as the model sees it
export type ToolDecl = {
    name: string
    description: string
    parameters: Record<string, unknown>
}

// sources: the meetings this result came from
export type ToolOutput = { result: unknown; sources: AskSource[] }

// A tool as runAgent runs it. The caller (AskService) owns the handlers, so runAgent does no DB work.
export type AgentTool<Args extends z.ZodType = z.ZodType> = {
    name: string
    description: string
    args: Args
    handler(args: z.output<Args>): ToolOutput
}

// runAgent validates args with the tool's zod schema
export type ToolCall = { id: string; name: string; args: unknown }

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
}

export type ChatResponse = {
    reply:
        | { kind: "text"; text: string }
        | { kind: "tool_calls"; calls: ToolCall[] }
    raw: string // the provider's response body, verbatim, for the log
    usage?: LlmResponse["usage"]
}

export type AgentFailureReason =
    ProviderFailureReason | "bad_answer" | "tool_error"

// What the caller logs for every ask outcome
export type AgentTrace = {
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
