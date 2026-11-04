import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import {
    banner,
    clearMeetings,
    failRequest,
    hangRequest,
    seedMeetings,
} from "./helpers"

const PAGE_URL = "**/api/meetings?cursor=*"

const DATES = (page: Page) => [page.locator("time")]

test.beforeEach(async ({ page, request }) => {
    await clearMeetings(request)
    await seedMeetings(request, 6)
    await page.goto("/")
})

test("shows the first page", async ({ page }) => {
    await expect(page.getByRole("article")).toHaveCount(5)
    await expect(
        page.getByRole("button", { name: "Load more" }),
    ).toHaveScreenshot("button.png")
})

test("loads the next page", async ({ page }) => {
    await page.getByRole("button", { name: "Load more" }).click()

    await expect(page.getByRole("article")).toHaveCount(6)
    await expect(page.getByRole("heading", { name: "Sync 1" })).toBeVisible()
    await expect(
        page.getByText("Loaded 1 more meeting, 6 meetings now shown."),
    ).toBeAttached()
    await expect(page.getByRole("button", { name: "Load more" })).toBeHidden()
})

test("pending state", async ({ page }) => {
    await hangRequest(page, PAGE_URL, "GET")
    await page.getByRole("button", { name: "Load more" }).click()

    const button = page.getByRole("button", { name: "Loading…" })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute("aria-busy", "true")
    await expect(button).toHaveScreenshot("pending.png", {
        animations: "disabled",
    })
})

test("failure keeps the list and offers a retry", async ({ page }) => {
    await failRequest(
        page,
        PAGE_URL,
        "GET",
        500,
        "INTERNAL",
        "Something went wrong on our side. Please try again.",
    )
    await page.getByRole("button", { name: "Load more" }).click()

    await expect(banner(page)).toHaveText("Couldn't load more items.")
    await expect(page.getByRole("article")).toHaveCount(5)
    await expect(page).toHaveScreenshot("failure.png", {
        fullPage: true,
        mask: DATES(page),
    })

    await page.unroute(PAGE_URL)
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(page.getByRole("article")).toHaveCount(6)
    await expect(banner(page)).toBeHidden()
})
