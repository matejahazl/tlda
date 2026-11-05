import { expect, test } from "@playwright/test"
import {
    banner,
    clearMeetings,
    failRequest,
    hangRequest,
    seedMeeting,
} from "./helpers"

const DELETE_URL = "**/api/meetings/*"

test.beforeEach(async ({ page, request }) => {
    await clearMeetings(request)
    await seedMeeting(request)
    await page.goto("/")
    await page
        .getByRole("button", { name: "Delete meeting: Weekly sync" })
        .click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    // an opaque backdrop keeps the page behind the dialog corners out of the shots
    await page.addStyleTag({
        content:
            "dialog::backdrop { background: #888 !important; backdrop-filter: none !important }",
    })
    // let the enter animation finish so the first frame is not captured mid-way
    await dialog.evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished)),
    )
})

test("dialog", async ({ page }) => {
    await expect(page.getByRole("dialog")).toHaveScreenshot("dialog.png")
})

test("cancel keeps the meeting", async ({ page }) => {
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(
        page.getByRole("heading", { name: "Weekly sync" }),
    ).toBeVisible()
    await expect(page).toHaveScreenshot("cancelled.png", {
        fullPage: true,
    })
})

test("escape keeps the meeting", async ({ page }) => {
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(
        page.getByRole("heading", { name: "Weekly sync" }),
    ).toBeVisible()
})

test("pending", async ({ page }) => {
    await hangRequest(page, DELETE_URL, "DELETE")
    await page
        .getByRole("button", { name: "Delete meeting", exact: true })
        .click()
    await expect(page.getByRole("button", { name: "Deleting…" })).toBeDisabled()
    await expect(page.getByRole("dialog")).toHaveScreenshot("pending.png")
})

test("failure", async ({ page }) => {
    await failRequest(
        page,
        DELETE_URL,
        "DELETE",
        500,
        "INTERNAL",
        "Something went wrong on our side. Please try again.",
    )
    await page
        .getByRole("button", { name: "Delete meeting", exact: true })
        .click()
    await expect(banner(page)).toContainText("Couldn't delete this meeting")
    await expect(page.getByRole("dialog")).toHaveScreenshot("failure.png")
})

test("success", async ({ page }) => {
    await page
        .getByRole("button", { name: "Delete meeting", exact: true })
        .click()
    await expect(page.getByText("Deleted Weekly sync.")).toBeVisible()
    await expect(page.getByText("No meetings yet")).toBeVisible()
    await expect(page).toHaveScreenshot("deleted.png", { fullPage: true })
})

test("404 counts as deleted", async ({ page }) => {
    await failRequest(
        page,
        DELETE_URL,
        "DELETE",
        404,
        "NOT_FOUND",
        "Not found.",
    )
    await page
        .getByRole("button", { name: "Delete meeting", exact: true })
        .click()
    await expect(page.getByText("Deleted Weekly sync.")).toBeVisible()
    await expect(page.getByRole("dialog")).toBeHidden()
})
