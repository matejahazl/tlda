import "server-only"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { ITEM_STATUSES } from "@/lib/schemas"
import type { Db } from "@/lib/server/db"
import { actionItems, meetings } from "@/lib/server/db"
import type { AskSource } from "@/types"

const MAX_TOOL_ROWS = 50 // max rows one tool call returns, so a result can't flood the context
const DEFAULT_TOOL_ROWS = 20 // rows returned when the model gives no limit
const MAX_SEARCH_QUERY_LENGTH = 100 // max characters in a search_items query

const limitArg = z
    .number()
    .int()
    .min(1)
    .max(MAX_TOOL_ROWS)
    .default(DEFAULT_TOOL_ROWS)

const searchItemsArgs = z.strictObject({
    query: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional(),
    status: z.enum(ITEM_STATUSES).optional(),
    limit: limitArg,
})

// Escapes LIKE wildcards so the model's text matches literally
function likePattern(text: string): string {
    return `%${text.replace(/[\\%_]/g, "\\$&")}%`
}

// The meetings a set of rows came from, unique, in first-seen order
function sourcesOf(rows: { meetingId: number; meetingTitle: string }[]) {
    const sources = new Map<number, AskSource>()
    for (const { meetingId, meetingTitle } of rows) {
        if (!sources.has(meetingId)) {
            sources.set(meetingId, { meetingId, title: meetingTitle })
        }
    }
    return [...sources.values()]
}

export function searchItemsTool(db: Db) {
    return {
        name: "search_items",
        description:
            "Search action items across all meetings, newest meeting first. Filter by text (case-insensitive substring) and/or status.",
        args: searchItemsArgs,
        handler({ query, status, limit }: z.output<typeof searchItemsArgs>) {
            const rows = db
                .select({
                    id: actionItems.id,
                    meetingId: actionItems.meetingId,
                    meetingTitle: meetings.title,
                    text: actionItems.text,
                    status: actionItems.status,
                })
                .from(actionItems)
                .innerJoin(meetings, eq(actionItems.meetingId, meetings.id))
                .where(
                    and(
                        query
                            ? sql`${actionItems.text} LIKE ${likePattern(query)} ESCAPE '\\'`
                            : undefined,
                        status ? eq(actionItems.status, status) : undefined,
                    ),
                )
                .orderBy(desc(meetings.id), asc(actionItems.id))
                .limit(limit)
                .all()

            return { result: { items: rows }, sources: sourcesOf(rows) }
        },
    }
}
