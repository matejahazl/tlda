import { describe, expect, it } from "vitest"
import { summaryLine } from "@/app/lib/format"
import { patchItem } from "@/app/lib/meetings"
import type { Meeting } from "@/types"

function meeting(
    id: number,
    statuses: ("open" | "in_progress" | "done")[],
): Meeting {
    return {
        id,
        title: `M${id}`,
        createdAt: "2026-10-09T10:00:00.000Z",
        items: statuses.map((status, i) => ({
            id: id * 10 + i,
            text: "t",
            status,
        })),
    }
}

describe("summaryLine", () => {
    it("handles none, one and many", () => {
        expect(summaryLine([])).toBe("Nothing tracked yet")
        expect(summaryLine([meeting(1, ["open"])])).toBe(
            "1 meeting · 1 open item",
        )
        expect(
            summaryLine([
                meeting(1, ["open", "done"]),
                meeting(2, ["in_progress", "open", "done"]),
            ]),
        ).toBe("2 meetings · 3 open items")
        expect(summaryLine([meeting(1, ["done"])])).toBe(
            "1 meeting · 0 open items",
        )
    })
})

describe("patchItem", () => {
    it("changes one item without mutating the input", () => {
        const before = [meeting(1, ["open", "open"]), meeting(2, ["open"])]
        const after = patchItem(before, 11, { status: "done" })

        expect(after[0].items.map((i) => i.status)).toEqual(["open", "done"])
        expect(after[1]).toEqual(before[1])
        expect(before[0].items[1].status).toBe("open")
    })
})
