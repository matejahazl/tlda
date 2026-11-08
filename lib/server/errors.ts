import "server-only"
import type { AgentFailureReason, FailureReason } from "@/integrations"
import type { ErrorCode } from "@/lib/shared"

// Extraction and ask failure reasons, mapped to the codes the client sees
export const LLM_FAILURE_CODES: Record<
    FailureReason | AgentFailureReason,
    ErrorCode
> = {
    timeout: "LLM_TIMEOUT",
    provider_unavailable: "LLM_UNAVAILABLE",
    provider_error: "INTERNAL",
    not_json: "LLM_BAD_OUTPUT",
    schema_mismatch: "LLM_BAD_OUTPUT",
    prose: "LLM_BAD_OUTPUT",
    bad_answer: "LLM_BAD_OUTPUT",
    tool_error: "INTERNAL",
    max_turns: "LLM_BAD_OUTPUT",
}
