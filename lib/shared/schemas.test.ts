import { describe, expect, it } from "vitest"
import {
    askSchema,
    createMeetingSchema,
    llmOutputSchema,
    MAX_ITEM_TEXT_LENGTH,
    MAX_ITEMS,
    MAX_QUESTION_LENGTH,
} from "@/lib/shared/schemas"

const NOTES = "Alice will send the report to Bob by Friday."

describe("cleanText", () => {
    const DIRTY = " Weekly\u0000\u0007 sync\u001b\u007f " // control characters and outer spaces
    const CLEAN = "Weekly sync"

    it("strips control characters and trims every text field", () => {
        const meeting = createMeetingSchema.parse({
            title: DIRTY,
            notes: `${NOTES}\n\tNext line${DIRTY}`,
        })
        const output = llmOutputSchema.parse({
            title: DIRTY,
            items: [{ text: DIRTY }, { text: CLEAN }],
        })

        expect(meeting.title).toBe(CLEAN)
        expect(meeting.notes).toBe(`${NOTES}\n\tNext line ${CLEAN}`) // newlines and tabs stay
        expect(askSchema.parse({ question: DIRTY }).question).toBe(CLEAN)
        expect(output.title).toBe(CLEAN)
        expect(output.items).toEqual([{ text: CLEAN }]) // cleaned before the dedupe
    })
})

describe("askSchema", () => {
    const parse = (value: unknown) => askSchema.safeParse(value)

    it("rejects missing, empty, whitespace-only and over-long questions and unknown keys", () => {
        for (const bad of [
            {},
            { question: "" },
            { question: " \t\n " },
            { question: "a".repeat(MAX_QUESTION_LENGTH + 1) },
            { question: "What's open?", extra: 1 },
        ]) {
            expect(parse(bad).success).toBe(false)
        }
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
