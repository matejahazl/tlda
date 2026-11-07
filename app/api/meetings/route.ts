import { createMeetingSchema, listMeetingsQuerySchema } from "@/lib/schemas"
import { parseOrThrow, readJson } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"
import { getMeetingService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic" // never serve the list from a cache

export const GET = withApi("/api/meetings", async (req, ctx) => {
    const searchParams = Object.fromEntries(new URL(req.url).searchParams)
    const { cursor } = parseOrThrow(
        listMeetingsQuerySchema,
        searchParams,
        "query",
    )
    const page = getMeetingService().list(cursor)
    ctx.addLogFields({ cursor, meetingCount: page.meetings.length })

    return { body: page }
})

export const POST = withApi("/api/meetings", async (req, ctx) => {
    const raw = await readJson(req)
    const { title, notes } = parseOrThrow(createMeetingSchema, raw)

    const meeting = await getMeetingService().create(
        {
            title,
            notes,
            rawNotes: (raw as { notes: string }).notes,
        },
        ctx.log,
    )
    ctx.addLogFields({ meetingId: meeting.id, itemCount: meeting.items.length })

    return { status: 201, body: meeting }
})
