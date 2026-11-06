import { beforeEach, describe, expect, it } from "vitest"
import { createDb, type Db } from "@/lib/server/db"
import { actionItems, meetings } from "@/lib/server/db/schema"
import type { ItemStatus } from "@/types"
import { searchItemsTool } from "./askTools"

let db: Db

function seedMeeting(title: string, items: [string, ItemStatus][]) {
    const { id } = db
        .insert(meetings)
        .values({ title, notes: "secret raw notes" })
        .returning({ id: meetings.id })
        .get()
    db.insert(actionItems)
        .values(
            items.map(([text, status]) => ({ meetingId: id, text, status })),
        )
        .run()
    return id
}

function search(args: Record<string, unknown> = {}) {
    const tool = searchItemsTool(db)
    return tool.handler(tool.args.parse(args))
}

const texts = (out: ReturnType<typeof search>) =>
    out.result.items.map((item) => item.text)

beforeEach(() => {
    db = createDb(":memory:")
})

describe("search_items", () => {
    let older: number
    let newer: number

    beforeEach(() => {
        older = seedMeeting("Pricing review", [
            ["Update the pricing page", "open"],
            ["Raise the price by 50%", "done"],
        ])
        newer = seedMeeting("Weekly sync", [
            ["Book the room", "in_progress"],
            ["Send PRICING notes to legal", "open"],
            ["Fix the user_id bug", "open"],
        ])
    })

    it("returns items newest meeting first, without the raw notes", () => {
        const out = search()

        expect(texts(out)).toEqual([
            "Book the room",
            "Send PRICING notes to legal",
            "Fix the user_id bug",
            "Update the pricing page",
            "Raise the price by 50%",
        ])
        expect(JSON.stringify(out)).not.toContain("secret raw notes")
    })

    it("filters by case-insensitive text and by status", () => {
        expect(texts(search({ query: "pricing" }))).toEqual([
            "Send PRICING notes to legal",
            "Update the pricing page",
        ])
        expect(
            texts(search({ query: "pricing", status: "open" })),
        ).toHaveLength(2)
        expect(texts(search({ status: "done" }))).toEqual([
            "Raise the price by 50%",
        ])
    })

    it("matches LIKE wildcards literally", () => {
        expect(texts(search({ query: "50%" }))).toEqual([
            "Raise the price by 50%",
        ])
        expect(texts(search({ query: "%" }))).toEqual([
            "Raise the price by 50%",
        ])
        expect(texts(search({ query: "o_m" }))).toEqual([]) // "_" as a wildcard would match "room"
        expect(texts(search({ query: "user_id" }))).toEqual([
            "Fix the user_id bug",
        ])
    })

    it("applies the limit", () => {
        expect(texts(search({ limit: 2 }))).toHaveLength(2)
    })

    it("lists each source meeting once, in result order", () => {
        expect(search().sources).toEqual([
            { meetingId: newer, title: "Weekly sync" },
            { meetingId: older, title: "Pricing review" },
        ])
        expect(search({ query: "nothing matches" }).sources).toEqual([])
    })
})
