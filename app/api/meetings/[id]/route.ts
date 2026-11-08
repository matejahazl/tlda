import { parseOrThrow } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"
import { idSchema } from "@/lib/shared"
import { getMeetingService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic"

export const DELETE = withApi<{ id: string }>(
    "/api/meetings/:id",
    async (_req, ctx) => {
        const id = parseOrThrow(idSchema, ctx.params.id, "id")
        ctx.addLogFields({ meetingId: id })

        getMeetingService().deleteMeeting(id)

        return { status: 204 }
    },
)
