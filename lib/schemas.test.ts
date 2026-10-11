import { describe, expect, it } from "vitest"
import {
    createMeetingSchema,
    itemIdSchema,
    llmOutputSchema,
    MAX_ITEM_TEXT_LENGTH,
    MAX_ITEMS,
    MAX_NOTES_LENGTH,
    MAX_TITLE_LENGTH,
} from "@/lib/schemas"

const NOTES = "Alice will send the report to Bob by Friday."

describe("createMeetingSchema", () => {
    it("rejects missing, empty, short and whitespace-only notes", () => {
        for (const body of [
            {},
            { notes: "" },
            { notes: "too short" },
            { notes: " ".repeat(50) },
            { notes: 42 },
        ]) {
            expect(createMeetingSchema.safeParse(body).success).toBe(false)
        }
    })

    it("rejects huge notes and long titles", () => {
        expect(
            createMeetingSchema.safeParse({
                notes: "a".repeat(MAX_NOTES_LENGTH + 1),
            }).success,
        ).toBe(false)
        expect(
            createMeetingSchema.safeParse({
                notes: NOTES,
                title: "a".repeat(MAX_TITLE_LENGTH + 1),
            }).success,
        ).toBe(false)
    })

    it("strips control characters but keeps newlines and tabs", () => {
        const parsed = createMeetingSchema.parse({
            notes: `${NOTES}\n\tNext line\u0000\u0007\u001b[0m\u007f`,
        })
        expect(parsed.notes).toBe(`${NOTES}\n\tNext line[0m`)
    })
})

describe("itemIdSchema", () => {
    it("accepts positive integer ids only", () => {
        expect(itemIdSchema.parse("42")).toBe(42)
        for (const id of ["0", "-1", "1.5", "abc", "", "1e3", "01", " 1"]) {
            expect(itemIdSchema.safeParse(id).success).toBe(false)
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
