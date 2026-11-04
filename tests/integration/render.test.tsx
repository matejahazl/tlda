import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Planner } from "@/app/components"
import type { Meeting } from "@/types"

const HTML = "<img src=x onerror=alert(1)>"

const meeting: Meeting = {
    id: 1,
    title: HTML,
    createdAt: "2026-10-09T10:00:00.000Z",
    items: [
        {
            id: 1,
            text: `Fix ${HTML} <script>alert(2)</script>`,
            status: "open",
        },
    ],
}

describe("safe rendering", () => {
    it("renders LLM and user text as plain text, never as markup", () => {
        const html = renderToStaticMarkup(
            <Planner
                initialPage={{
                    meetings: [meeting],
                    nextCursor: null,
                }}
            />,
        )

        expect(html).not.toContain("<img")
        expect(html).not.toContain("<script")
        expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
        expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;")
    })
})
