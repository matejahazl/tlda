import "server-only"
import { and, asc, count, desc, eq, sql } from "drizzle-orm"
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

const listMeetingsArgs = z.strictObject({ limit: limitArg })

const getMeetingArgs = z.strictObject({ id: z.number().int().positive() })

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

export function listMeetingsTool(db: Db) {
    return {
        name: "list_meetings",
        description:
            "List saved meetings, newest first, with how many action items each has and how many are done.",
        args: listMeetingsArgs,
        handler({ limit }: z.output<typeof listMeetingsArgs>) {
            const rows = db
                .select({
                    id: meetings.id,
                    title: meetings.title,
                    createdAt: meetings.createdAt,
                    itemCount: count(actionItems.id),
                    doneCount: sql<number>`count(case when ${actionItems.status} = ${"done"} then 1 end)`,
                })
                .from(meetings)
                .leftJoin(actionItems, eq(actionItems.meetingId, meetings.id))
                .groupBy(meetings.id)
                .orderBy(desc(meetings.id))
                .limit(limit)
                .all()

            return {
                result: { meetings: rows },
                sources: sourcesOf(
                    rows.map(({ id, title }) => ({
                        meetingId: id,
                        meetingTitle: title,
                    })),
                ),
            }
        },
    }
}

export function getMeetingTool(db: Db) {
    return {
        name: "get_meeting",
        description:
            "Get one meeting by id with all its action items and their statuses.",
        args: getMeetingArgs,
        handler({ id }: z.output<typeof getMeetingArgs>) {
            const meeting = db.query.meetings
                .findFirst({
                    columns: { id: true, title: true, createdAt: true }, // no raw notes
                    with: {
                        items: {
                            columns: { id: true, text: true, status: true },
                            orderBy: asc(actionItems.id),
                        },
                    },
                    where: eq(meetings.id, id),
                })
                .sync()

            if (!meeting) {
                return { result: { error: "not_found" }, sources: [] }
            }
            return {
                result: meeting,
                sources: [{ meetingId: meeting.id, title: meeting.title }],
            }
        },
    }
}
