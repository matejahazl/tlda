import { askSchema } from "@/lib/schemas"
import { parseOrThrow, readJson } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"
import { getAskService } from "@/services"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic" // answers always reflect the current data

export const POST = withApi("/api/ask", async (req) => {
    const { question } = parseOrThrow(askSchema, await readJson(req))
    const body = await getAskService().ask(question)
    return { body }
})
