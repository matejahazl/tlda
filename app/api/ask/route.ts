import { parseOrThrow, readJson } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"
import { askSchema } from "@/lib/shared"
import { getAskService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic" // answers always reflect the current data

export const POST = withApi("/api/ask", async (req, ctx) => {
    const { question } = parseOrThrow(askSchema, await readJson(req))
    const body = await getAskService().ask(question, ctx.log)

    return { body }
})
