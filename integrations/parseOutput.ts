import { llmOutputSchema } from "@/lib/schemas"
import type { Extraction } from "./types"

const JSON_FENCE = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/i // one optional fence around the whole reply

type FailureReason = "not_json" | "schema_mismatch" | "prose"

export type ParseResult =
    { ok: true; value: Extraction } | { ok: false; reason: FailureReason }

// Strict: the reply must be JSON of the right shape, nothing else. Never throws.
export function parseLlmOutput(text: string): ParseResult {
    const trimmed = text.trim()
    const json = JSON_FENCE.exec(trimmed)?.[1] ?? trimmed

    let data: unknown
    try {
        data = JSON.parse(json)
    } catch {
        return { ok: false, reason: "not_json" }
    }

    const result = llmOutputSchema.safeParse(data)
    if (!result.success) {
        // A bad item (too long or multi-line) means the model wrote prose, not an item
        const isBadItem = result.error.issues.some(
            (issue) =>
                issue.path[0] === "items" &&
                typeof issue.path[1] === "number" &&
                (issue.code === "too_big" || issue.code === "custom"),
        )
        return { ok: false, reason: isBadItem ? "prose" : "schema_mismatch" }
    }
    return { ok: true, value: result.data }
}
