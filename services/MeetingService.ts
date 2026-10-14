import "server-only"
import { eq } from "drizzle-orm"
import type { Logger } from "pino"
import type { FailureReason, LlmIntegrationService } from "@/integrations"
import { AppError, ERROR_TABLE } from "@/lib/errors"
import type { Db } from "@/lib/server/db"
import { actionItems, meetings } from "@/lib/server/db"
import type { ActionItem, ErrorCode, ItemStatus, Meeting } from "@/types"

const DEFAULT_MEETING_TITLE = "Untitled meeting" // used when neither the user nor the model gives a valid title

type FailureCode = FailureReason | "no_action_items"

const FAILURE_CODES: Record<FailureCode, ErrorCode> = {
    timeout: "LLM_TIMEOUT",
    provider_unavailable: "LLM_UNAVAILABLE",
    provider_error: "INTERNAL",
    not_json: "LLM_BAD_OUTPUT",
    schema_mismatch: "LLM_BAD_OUTPUT",
    prose: "LLM_BAD_OUTPUT",
    no_action_items: "NO_ACTION_ITEMS",
}

const MEETING_COLUMNS = {
    id: meetings.id,
    title: meetings.title,
    createdAt: meetings.createdAt,
}
const ITEM_COLUMNS = {
    id: actionItems.id,
    text: actionItems.text,
    status: actionItems.status,
}

type CreateMeetingInput = {
    title?: string // typed by the user
    notes: string // cleaned notes, saved and sent to the model
    rawNotes: string // notes exactly as submitted, for the log only
}

export class MeetingService {
    constructor(
        private readonly db: Db,
        private readonly llm: LlmIntegrationService,
    ) {}

    list(): Meeting[] {
        return this.db.query.meetings
            .findMany({
                columns: { id: true, title: true, createdAt: true }, // no raw notes
                with: {
                    items: {
                        columns: { id: true, text: true, status: true },
                        orderBy: (item, { asc }) => asc(item.id),
                    },
                },
                orderBy: (meeting, { desc }) => [
                    desc(meeting.createdAt),
                    desc(meeting.id),
                ],
            })
            .sync()
    }

    async create(input: CreateMeetingInput, log: Logger): Promise<Meeting> {
        const startedAt = performance.now()

        const result = await this.llm.extract(input.notes)

        const latencyMs = Math.round(performance.now() - startedAt)

        const reason: FailureCode | undefined = !result.ok
            ? result.reason
            : result.extraction.items.length === 0
              ? "no_action_items"
              : undefined
        const level = reason ? ERROR_TABLE[FAILURE_CODES[reason]].level : "info"

        log[level](
            {
                event: "extraction",
                ...this.llm.info,
                outcome: reason ? "error" : "success",
                reason,
                rawNotes: input.rawNotes,
                llmResponse: result.response?.text ?? null,
                inputTokens: result.response?.usage?.inputTokens,
                outputTokens: result.response?.usage?.outputTokens,
                latencyMs,
                itemCount: result.ok
                    ? result.extraction.items.length
                    : undefined,
                err: result.ok ? undefined : result.cause,
            },
            "extraction completed",
        )

        if (!result.ok) {
            throw new AppError(FAILURE_CODES[result.reason], {
                cause: result.cause,
            })
        }
        if (result.extraction.items.length === 0) {
            throw new AppError(FAILURE_CODES.no_action_items)
        }

        return this.db.transaction((tx) => {
            const meeting = tx
                .insert(meetings)
                .values({
                    title:
                        input.title ??
                        result.extraction.title ??
                        DEFAULT_MEETING_TITLE,
                    notes: input.notes,
                })
                .returning(MEETING_COLUMNS)
                .get()
            const saved = tx
                .insert(actionItems)
                .values(
                    result.extraction.items.map(({ text }) => ({
                        meetingId: meeting.id,
                        text,
                        status: "open" as const,
                    })),
                )
                .returning(ITEM_COLUMNS)
                .all()
            return { ...meeting, items: saved }
        })
    }

    updateItemStatus(id: number, status: ItemStatus): ActionItem {
        const item = this.db
            .update(actionItems)
            .set({ status })
            .where(eq(actionItems.id, id))
            .returning(ITEM_COLUMNS)
            .get()
        if (!item) {
            throw new AppError("NOT_FOUND")
        }
        return item
    }
}
