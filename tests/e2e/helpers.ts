import type { APIRequestContext, Page } from "@playwright/test"

export const NOTES =
    "Sam will send the budget to finance by Friday.\nPriya should book the venue.\nWe discussed the weather."

export async function clearMeetings(request: APIRequestContext) {
    const meetings: { id: number }[] = await (
        await request.get("/api/meetings")
    ).json()
    for (const { id } of meetings) {
        await request.delete(`/api/meetings/${id}`)
    }
}

export async function seedMeeting(
    request: APIRequestContext,
    title = "Weekly sync",
) {
    await request.post("/api/meetings", { data: { title, notes: NOTES } })
}

export async function fillForm(page: Page, notes = NOTES) {
    await page.getByRole("textbox", { name: "Title" }).fill("Weekly sync")
    await page.getByRole("textbox", { name: "Notes" }).fill(notes)
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
                      error: { code, message, requestId: "e2e" },
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
