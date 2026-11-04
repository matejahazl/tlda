import "server-only"
import type { FailureReason } from "@/integrations"
import type { ErrorCode } from "@/types"

export const LLM_FAILURE_CODES: Record<FailureReason, ErrorCode> = {
    timeout: "LLM_TIMEOUT",
    provider_unavailable: "LLM_UNAVAILABLE",
    provider_error: "INTERNAL",
    not_json: "LLM_BAD_OUTPUT",
    schema_mismatch: "LLM_BAD_OUTPUT",
    prose: "LLM_BAD_OUTPUT",
}
