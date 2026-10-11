import { describe, expect, it } from "vitest"
import {
    createMeetingSchema,
    itemIdSchema,
    llmOutputSchema,
    MAX_ITEM_TEXT_LENGTH,
    MAX_ITEMS,
    MAX_NOTES_LENGTH,
    MAX_TITLE_LENGTH,
    setStatusSchema,
} from "@/lib/schemas"

const NOTES = "Alice will send the report to Bob by Friday."

describe("createMeetingSchema", () => {
    it("accepts valid notes with and without a title", () => {
        expect(createMeetingSchema.parse({ notes: NOTES })).toEqual({
            title: undefined,
            notes: NOTES,
        })
        expect(
            createMeetingSchema.parse({ title: " Sync ", notes: NOTES }).title,
        ).toBe("Sync")
    })

    it("treats a blank title as not provided", () => {
        expect(
            createMeetingSchema.parse({ title: "   ", notes: NOTES }).title,
        ).toBeUndefined()
    })

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

    it("rejects unknown keys", () => {
        expect(
            createMeetingSchema.safeParse({ notes: NOTES, extra: 1 }).success,
        ).toBe(false)
    })

    it("strips control characters but keeps newlines and tabs", () => {
        const parsed = createMeetingSchema.parse({
            notes: `${NOTES}\n\tNext line\u0000\u0007\u001b[0m\u007f`,
        })
        expect(parsed.notes).toBe(`${NOTES}\n\tNext line[0m`)
    })
})

describe("setStatusSchema and itemIdSchema", () => {
    it("accepts the three statuses only", () => {
        for (const status of ["open", "in_progress", "done"]) {
            expect(setStatusSchema.safeParse({ status }).success).toBe(true)
        }
        for (const body of [
            { status: "finished" },
            {},
            { status: "done", x: 1 },
        ]) {
            expect(setStatusSchema.safeParse(body).success).toBe(false)
        }
    })

    it("accepts positive integer ids only", () => {
        expect(itemIdSchema.parse("42")).toBe(42)
        for (const id of ["0", "-1", "1.5", "abc", "", "1e3", "01", " 1"]) {
            expect(itemIdSchema.safeParse(id).success).toBe(false)
        }
    })
})

describe("llmOutputSchema", () => {
    const parse = (value: unknown) => llmOutputSchema.safeParse(value)

    it("accepts items and trims them", () => {
        const result = parse({
            items: [{ text: "  Send report " }, { text: "Book room" }],
        })
        expect(result.data?.items).toEqual([
            { text: "Send report" },
            { text: "Book room" },
        ])
    })

    it("accepts an empty list", () => {
        expect(parse({ items: [] }).data?.items).toEqual([])
    })

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

    it("rejects wrong shapes", () => {
        for (const value of [
            null,
            "text",
            [],
            {},
            { items: "x" },
            { items: {} },
        ]) {
            expect(parse(value).success).toBe(false)
        }
    })

    it("lets any title through, since it is checked separately", () => {
        expect(parse({ title: 123, items: [] }).success).toBe(true)
    })
})
