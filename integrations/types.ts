// What LlmIntegrationService takes from and returns to the services.
import type { z } from "zod"
import type { AskSource, llmOutputSchema } from "@/lib/shared"
import type { LlmUsage } from "./providers/types"

// Failure reasons (mapped to error codes by LLM_FAILURE_CODES in lib/server/errors.ts)
export type ProviderFailureReason =
    "timeout" | "provider_unavailable" | "provider_error"

export type ExtractionFailureReason =
    ProviderFailureReason | "not_json" | "schema_mismatch" | "prose"

export type AgentFailureReason =
    ProviderFailureReason | "bad_answer" | "tool_error" | "max_turns"

// Extraction (extract)

export type ExtractionResult =
    | ({ ok: true; extraction: Extraction } & ExtractionRun)
    | ({
          ok: false
          reason: ExtractionFailureReason
          cause?: unknown // the provider error, for the log only
      } & ExtractionRun)

export type Extraction = z.output<typeof llmOutputSchema>

// What the caller logs for every extraction outcome
type ExtractionRun = {
    llmResponse: string | null // the reply, verbatim; null when the call failed before a reply
    usage: LlmUsage
}

// Agent (runAgent)

// A tool as runAgent runs it
export type AgentTool<Args extends z.ZodType = z.ZodType> = {
    name: string
    description: string
    args: Args
    handler(args: z.output<Args>): ToolHandlerOutput
}

export type ToolHandlerOutput = {
    result: unknown
    sources: AskSource[] // the meetings this result came from
    rows: number // how many rows it holds, for the log
}

export type AgentResult =
    | ({ ok: true; answer: string; sources: AskSource[] } & AgentRun)
    | ({
          ok: false
          reason: AgentFailureReason
          cause?: unknown // the provider error, for the log only
      } & AgentRun)

// What the caller logs for every ask outcome
type AgentRun = {
    trace: AgentTrace
    usage: Required<LlmUsage> // summed over all turns
    turns: number
}

export type AgentTrace = {
    toolCalls: ToolCallTrace[]
    responses: string[] // each raw provider response, verbatim
}

export type ToolCallTrace = {
    name: string
    args: unknown
    ok: boolean // false when the tool was unknown or its args were invalid, so the model got an error back
    rows: number
    durationMs: number
}
