import "server-only"
import type { AgentTool, LlmIntegrationService } from "@/integrations"
import { AppError } from "@/lib/errors"
import type { Db } from "@/lib/server/db"
import { LLM_FAILURE_CODES } from "@/lib/server/errors"
import type { AskAnswer } from "@/types"
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

    // shortcut: no ask event log yet, it comes in build step 13
    async ask(question: string): Promise<AskAnswer> {
        const result = await this.llm.runAgent({ question, tools: this.tools })
        if (!result.ok) {
            throw new AppError(LLM_FAILURE_CODES[result.reason], {
                cause: result.cause,
            })
        }
        return { answer: result.answer, sources: result.sources }
    }
}
