import { describe, expect, it } from "vitest"
import {
    createMeetingSchema,
    llmOutputSchema,
    MAX_ITEM_TEXT_LENGTH,
    MAX_ITEMS,
} from "@/lib/schemas"

const NOTES = "Alice will send the report to Bob by Friday."

describe("createMeetingSchema", () => {
    it("strips control characters but keeps newlines and tabs", () => {
        const parsed = createMeetingSchema.parse({
            notes: `${NOTES}\n\tNext line\u0000\u0007\u001b[0m\u007f`,
        })
        expect(parsed.notes).toBe(`${NOTES}\n\tNext line[0m`)
    })
})

describe("llmOutputSchema", () => {
    const parse = (value: unknown) => llmOutputSchema.safeParse(value)

    it("dedupes identical items", () => {
        const result = parse({
            items: [
                { text: "Send report" },
                { text: "Send report" },
                { text: "Book room" },
            ],
        })
        expect(result.data?.items).toHaveLength(2)
    })

    it("rejects the whole response when one item is bad", () => {
        for (const bad of [
            { text: "" },
            { text: "a".repeat(MAX_ITEM_TEXT_LENGTH + 1) },
            { text: "two\nlines" },
            { text: 5 },
        ]) {
            expect(parse({ items: [{ text: "fine" }, bad] }).success).toBe(
                false,
            )
        }
    })

    it("rejects more than the maximum number of items instead of truncating", () => {
        const items = Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({
            text: `Item ${i}`,
        }))
        expect(parse({ items }).success).toBe(false)
    })
})
