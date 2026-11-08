import "server-only"
import type { Logger } from "pino"
import type { AgentTool, LlmIntegrationService } from "@/integrations"
import type { Db } from "@/lib/server/db"
import { LLM_FAILURE_CODES } from "@/lib/server/errors"
import type { AskAnswer } from "@/lib/shared"
import { AppError, ERROR_TABLE } from "@/lib/shared"
import { getMeetingTool, listMeetingsTool, searchItemsTool } from "./askTools"

export class AskService {
    private readonly tools: AgentTool[]

    constructor(
        db: Db,
        private readonly llm: LlmIntegrationService,
    ) {
        this.tools = [
            searchItemsTool(db),
            listMeetingsTool(db),
            getMeetingTool(db),
        ]
    }

    async ask(question: string, log: Logger): Promise<AskAnswer> {
        const startedAt = performance.now()

        const result = await this.llm.runAgent({ question, tools: this.tools })

        const latencyMs = Math.round(performance.now() - startedAt)
        const code = result.ok ? undefined : LLM_FAILURE_CODES[result.reason]
        const level = code ? ERROR_TABLE[code].level : "info"
        const logRawText = !result.ok || log.isLevelEnabled("debug")

        log[level](
            {
                event: "ask",
                ...this.llm.info,
                outcome: result.ok ? "success" : "error",
                reason: result.ok ? undefined : result.reason,
                ...(logRawText && {
                    question,
                    llmResponses: result.trace.responses,
                }),
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                latencyMs,
                turns: result.turns,
                toolCalls: result.trace.toolCalls,
                err: result.ok ? undefined : result.cause,
            },
            "ask completed",
        )

        if (!result.ok) {
            throw new AppError(LLM_FAILURE_CODES[result.reason], {
                cause: result.cause,
            })
        }

        return { answer: result.answer, sources: result.sources }
    }
}
