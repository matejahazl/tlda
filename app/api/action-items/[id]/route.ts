import { parseOrThrow, readJson } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"
import { idSchema, patchItemSchema } from "@/lib/shared"
import { getMeetingService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic"

export const PATCH = withApi<{ id: string }>(
    "/api/action-items/:id",
    async (req, ctx) => {
        const id = parseOrThrow(idSchema, ctx.params.id, "id")
        ctx.addLogFields({ itemId: id })
        const { status } = parseOrThrow(patchItemSchema, await readJson(req))
        ctx.addLogFields({ newStatus: status })

        const item = getMeetingService().updateItemStatus(id, status)

        return { body: item }
    },
)
