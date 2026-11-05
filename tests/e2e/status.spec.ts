import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import { clearMeetings, seedMeeting } from "./helpers"

const FIRST_ITEM = /Status: Sam will/
const SECOND_ITEM = /Status: Priya should/

test.beforeEach(async ({ page, request }) => {
    await clearMeetings(request)
    await seedMeeting(request)
    await page.goto("/")
})

test("each status", async ({ page }) => {
    const first = group(page, FIRST_ITEM)
    const second = group(page, SECOND_ITEM)
    await pick(first, "In progress")
    await pick(second, "Done")
    await expect(page.getByText("1 of 2 done")).toBeVisible()
    await expect(page).toHaveScreenshot("mixed.png", {
        fullPage: true,
    })
})

test("all done", async ({ page }) => {
    await pick(group(page, FIRST_ITEM), "Done")
    await pick(group(page, SECOND_ITEM), "Done")
    await expect(page.getByText("2 of 2 done")).toBeVisible()
    await expect(page).toHaveScreenshot("all-done.png", {
        fullPage: true,
    })
})

test("back to open", async ({ page }) => {
    const first = group(page, FIRST_ITEM)
    await pick(first, "Done")
    await expect(page.getByText("1 of 2 done")).toBeVisible()
    await pick(first, "Open")
    await expect(page.getByText("0 of 2 done")).toBeVisible()
})

test("status survives a reload", async ({ page }) => {
    await pick(group(page, FIRST_ITEM), "In progress")
    await page.reload()
    await expect(
        group(page, FIRST_ITEM).getByRole("button", { name: "In progress" }),
    ).toHaveAttribute("aria-pressed", "true")
})

test("failed save rolls back", async ({ page }) => {
    let fail!: () => void
    const release = new Promise<void>((resolve) => (fail = resolve))
    await page.route("**/api/action-items/*", async (route) => {
        await release
        await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
                error: {
                    code: "INTERNAL",
                    message:
                        "Something went wrong on our side. Please try again.",
                    requestId: "e2e",
                },
            }),
        })
    })
    const first = group(page, FIRST_ITEM)
    await pick(first, "Done")
    // flipped instantly, before the server answers
    await expect(page.getByText("1 of 2 done")).toBeVisible()
    await expect(page).toHaveScreenshot("optimistic.png", {
        fullPage: true,
    })
    fail()
    await expect(page.getByText("0 of 2 done")).toBeVisible()
    await expect(first.getByRole("button", { name: "Open" })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page).toHaveScreenshot("rolled-back.png", {
        fullPage: true,
    })
})

function group(page: Page, name: RegExp) {
    return page.getByRole("group", { name })
}

async function pick(statusGroup: Locator, label: string) {
    const button = statusGroup.getByRole("button", { name: label })
    await button.click()
    await expect(button).toHaveAttribute("aria-pressed", "true")
}
