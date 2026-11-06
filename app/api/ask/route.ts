import { askSchema } from "@/lib/schemas"
import { parseOrThrow, readJson } from "@/lib/server/validate"
import { withApi } from "@/lib/server/withApi"

export const runtime = "nodejs" // better-sqlite3 needs Node
export const dynamic = "force-dynamic" // answers always reflect the current data

export const POST = withApi("/api/ask", async (req) => {
    parseOrThrow(askSchema, await readJson(req))
    // shortcut: stub answer until AskService exists (build step 3)
    return { body: { answer: "stub", sources: [] } }
})
