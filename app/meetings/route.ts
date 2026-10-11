import { withApi } from "@/lib/server/withApi"
import { getMeetingService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic" // never serve the list from a cache

export const GET = withApi("/meetings", async (_req, ctx) => {
    const meetings = getMeetingService().list()
    ctx.addLogFields({ meetingCount: meetings.length })
    return { body: meetings }
})
