import { createMeetingSchema } from "@/lib/schemas"
import { parseOrThrow, readJson } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"
import { getMeetingService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic"

export const POST = withApi("/notes/extract", async (req, ctx) => {
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
