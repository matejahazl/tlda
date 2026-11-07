import { expect, test } from "@playwright/test"
import { MAX_NOTES_LENGTH } from "@/lib/schemas"
import {
    banner,
    clearMeetings,
    failRequest,
    fillForm,
    hangRequest,
    NOTES,
    seedMeeting,
} from "./helpers"

test.beforeEach(async ({ request }) => {
    await clearMeetings(request)
})

test("empty state", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("No meetings yet")).toBeVisible()
    await expect(page).toHaveScreenshot("empty.png", { fullPage: true })
})

test("meeting list", async ({ page, request }) => {
    await seedMeeting(request)
    await page.goto("/")
    await page.getByRole("button", { name: "In progress" }).first().click()
    await page.getByRole("button", { name: "Done" }).nth(1).click()
    await expect(
        page.getByRole("button", { name: "Done" }).nth(1),
    ).toHaveAttribute("aria-pressed", "true")
    await expect(page).toHaveScreenshot("list.png", {
        fullPage: true,
    })
})

test("processing state", async ({ page }) => {
    await hangRequest(page, "**/api/meetings", "POST")
    await page.goto("/")
    await fillForm(page)
    await page.getByRole("button", { name: "Extract action items" }).click()
    await expect(
        page.getByText("Extracting action items from your notes"),
    ).toBeVisible()
    await expect(page).toHaveScreenshot("processing.png", { fullPage: true })
})

test("success message", async ({ page }) => {
    await page.goto("/")
    await fillForm(page)
    await page.getByRole("button", { name: "Extract action items" }).click()
    await expect(page.getByText("Added Weekly sync with 2")).toBeVisible()
    await expect(page).toHaveScreenshot("created.png", {
        fullPage: true,
    })
})

const ERRORS = [
    [
        422,
        "NO_ACTION_ITEMS",
        "No action items could be found in these notes. Try adding who needs to do what.",
    ],
    [
        502,
        "LLM_BAD_OUTPUT",
        "The AI response couldn't be used. Please try again.",
    ],
    [
        502,
        "LLM_UNAVAILABLE",
        "The AI service is busy or unavailable. Please try again in a moment.",
    ],
    [504, "LLM_TIMEOUT", "This took too long. Please try again."],
    [500, "INTERNAL", "Something went wrong on our side. Please try again."],
] as const

for (const [status, code, message] of ERRORS) {
    test(`error state: ${code}`, async ({ page }) => {
        await failRequest(
            page,
            "**/api/meetings",
            "POST",
            status,
            code,
            message,
        )
        await page.goto("/")
        await fillForm(page)
        await page.getByRole("button", { name: "Extract action items" }).click()
        await expect(banner(page)).toContainText(message)
        await expect(page).toHaveScreenshot(`error-${code}.png`, {
            fullPage: true,
        })
    })
}

test("notes hint: too short", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("textbox", { name: "Notes" }).fill("Too short")
    await expect(page.getByText("Add a bit more detail")).toBeVisible()
    await expect(page.locator("#meeting-form")).toHaveScreenshot(
        "hint-short.png",
    )
})

test("notes hint: too long", async ({ page }) => {
    await page.goto("/")
    await page
        .getByRole("textbox", { name: "Notes" })
        .fill("a".repeat(MAX_NOTES_LENGTH + 1))
    await expect(page.getByText("Notes are too long")).toBeVisible()
    await expect(page.locator("#meeting-form")).toHaveScreenshot(
        "hint-long.png",
    )
})

test("form ready", async ({ page }) => {
    await page.goto("/")
    await fillForm(page, NOTES)
    await expect(
        page.getByRole("button", { name: "Extract action items" }),
    ).toBeEnabled()
    await expect(page.locator("#meeting-form")).toHaveScreenshot(
        "form-ready.png",
    )
})
