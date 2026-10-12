import { itemIdSchema, setStatusSchema } from "@/lib/schemas"
import { parseOrThrow, readJson } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"
import { getMeetingService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic"

export const PATCH = withApi<{ id: string }>(
    "/action-items/:id",
    async (req, ctx) => {
        const id = parseOrThrow(itemIdSchema, ctx.params.id, "id")
        ctx.addLogFields({ itemId: id })
        const { status } = parseOrThrow(setStatusSchema, await readJson(req))
        ctx.addLogFields({ newStatus: status })

        const item = getMeetingService().updateItemStatus(id, status)
        return { body: item }
    },
)
