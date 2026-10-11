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
            <Planner initialMeetings={[meeting]} />,
        )

        expect(html).not.toContain("<img")
        expect(html).not.toContain("<script")
        expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
        expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;")
    })

    it("shows the empty state and the summary when there are no meetings", () => {
        const html = renderToStaticMarkup(<Planner initialMeetings={[]} />)
        expect(html).toContain("No meetings yet")
        expect(html).toContain("Nothing tracked yet")
    })

    it("marks the saved status with aria-pressed", () => {
        const html = renderToStaticMarkup(
            <Planner
                initialMeetings={[
                    {
                        ...meeting,
                        items: [
                            { id: 1, text: "Do it", status: "in_progress" },
                        ],
                    },
                ]}
            />,
        )
        expect(html).toMatch(
            /aria-pressed="true"[^>]*>(?:<svg.*?<\/svg>)In progress/,
        )
        expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
    })
})
