import type { APIRequestContext, Page } from "@playwright/test"

export const NOTES =
    "Sam will send the budget to finance by Friday.\nPriya should book the venue.\nWe discussed the weather."

// A stubbed /api/ask reply, with line breaks the answer must keep
export const ANSWER = {
    answer: "Two items are still open:\nSam will send the budget to finance by Friday.\nPriya should book the venue.",
    sources: [{ meetingId: 1, title: "Weekly sync" }],
}

export async function clearMeetings(request: APIRequestContext) {
    // the list is paged, so keep deleting the first page until it is empty
    for (;;) {
        const { meetings }: { meetings: { id: number }[] } = await (
            await request.get("/api/meetings")
        ).json()
        if (meetings.length === 0) {
            return
        }
        for (const { id } of meetings) {
            await request.delete(`/api/meetings/${id}`)
        }
    }
}

export async function seedMeeting(
    request: APIRequestContext,
    title = "Weekly sync",
) {
    await request.post("/api/meetings", { data: { title, notes: NOTES } })
}

export async function seedMeetings(request: APIRequestContext, count: number) {
    for (let i = 1; i <= count; i++) {
        await seedMeeting(request, `Sync ${i}`)
    }
}

export async function fillForm(page: Page, notes = NOTES) {
    await page.getByRole("textbox", { name: "Title" }).fill("Weekly sync")
    await page.getByRole("textbox", { name: "Notes" }).fill(notes)
}

export async function askQuestion(page: Page, question = "What's still open?") {
    await page.getByRole("textbox", { name: "Question" }).fill(question)
    await page.getByRole("button", { name: "Ask", exact: true }).click()
}

// Answers a request on the given method with a 200 and the given JSON body
export async function answerRequest(
    page: Page,
    url: string,
    method: string,
    body: unknown,
) {
    await page.route(url, (route) =>
        route.request().method() === method
            ? route.fulfill({
                  status: 200,
                  contentType: "application/json",
                  body: JSON.stringify(body),
              })
            : route.fallback(),
    )
}

// Answers a request on the given method with an API error envelope
export async function failRequest(
    page: Page,
    url: string,
    method: string,
    status: number,
    code: string,
    message: string,
) {
    await page.route(url, (route) =>
        route.request().method() === method
            ? route.fulfill({
                  status,
                  contentType: "application/json",
                  body: JSON.stringify({
                      error: { code, message, requestId: "browser" },
                  }),
              })
            : route.fallback(),
    )
}

// Never answers a request on the given method, so the pending state stays on screen
export async function hangRequest(page: Page, url: string, method: string) {
    await page.route(url, (route) =>
        route.request().method() === method
            ? new Promise<void>(() => {})
            : route.fallback(),
    )
}

// Next adds its own role="alert" route announcer, so target the banners by content
export function banner(page: Page) {
    return page.locator('[role="alert"]:not(#__next-route-announcer__)')
}
