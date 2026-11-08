import "server-only"
import { desc, eq, lt } from "drizzle-orm"
import type { Logger } from "pino"
import type { LlmIntegrationService } from "@/integrations"
import type { Db } from "@/lib/server/db"
import {
    actionItems,
    ITEM_COLUMNS,
    MEETING_COLUMNS,
    meetings,
} from "@/lib/server/db"
import { LLM_FAILURE_CODES } from "@/lib/server/errors"
import type {
    ActionItem,
    CreateMeetingInput,
    ItemStatus,
    Meeting,
    PaginatedMeetings,
} from "@/lib/shared"
import { AppError, ERROR_TABLE } from "@/lib/shared"

const DEFAULT_MEETING_TITLE = "Untitled meeting" // used when neither the user nor the model gives a valid title
const MEETINGS_PAGE_SIZE = 5 // meetings per page of the list

export class MeetingService {
    constructor(
        private readonly db: Db,
        private readonly llm: LlmIntegrationService,
    ) {}

    list(cursor?: number): PaginatedMeetings {
        const rows = this.db.query.meetings
            .findMany({
                columns: { id: true, title: true, createdAt: true }, // no raw notes
                with: {
                    items: {
                        columns: {
                            id: true,
                            meetingId: true,
                            text: true,
                            status: true,
                        },
                        orderBy: (item, { asc }) => asc(item.id),
                    },
                },
                where: cursor ? lt(meetings.id, cursor) : undefined,
                orderBy: desc(meetings.id),
                limit: MEETINGS_PAGE_SIZE + 1,
            })
            .sync()
        const page = rows.slice(0, MEETINGS_PAGE_SIZE)

        return {
            meetings: page,
            nextCursor:
                rows.length > page.length ? page[page.length - 1].id : null,
        }
    }

    async create(input: CreateMeetingInput, log: Logger): Promise<Meeting> {
        const startedAt = performance.now()

        const result = await this.llm.extract(input.notes)

        const latencyMs = Math.round(performance.now() - startedAt)

        let reason: string | undefined
        let error: AppError | undefined

        if (!result.ok) {
            reason = result.reason
            error = new AppError(LLM_FAILURE_CODES[result.reason], {
                cause: result.cause,
            })
        } else if (result.extraction.items.length === 0) {
            reason = "no_action_items"
            error = new AppError("NO_ACTION_ITEMS")
        }

        const level = error ? ERROR_TABLE[error.code].level : "info"
        const logRawText = Boolean(error) || log.isLevelEnabled("debug")

        log[level](
            {
                event: "extraction",
                ...this.llm.info,
                outcome: error ? "error" : "success",
                reason,
                ...(logRawText && {
                    rawNotes: input.rawNotes,
                    llmResponse: result.llmResponse,
                }),
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                latencyMs,
                itemCount: result.ok
                    ? result.extraction.items.length
                    : undefined,
                err: result.ok ? undefined : result.cause,
            },
            "extraction completed",
        )

        if (error || !result.ok) {
            throw error
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

    deleteMeeting(id: number): void {
        const deleted = this.db
            .delete(meetings)
            .where(eq(meetings.id, id))
            .returning({ id: meetings.id })
            .get()

        if (!deleted) {
            throw new AppError("NOT_FOUND")
        }
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
