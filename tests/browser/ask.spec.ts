import { expect, test } from "@playwright/test"
import { MAX_QUESTION_LENGTH } from "@/lib/schemas"
import {
    ANSWER,
    answerRequest,
    askQuestion,
    banner,
    failRequest,
    hangRequest,
} from "./helpers"

const UNAVAILABLE =
    "The AI service is busy or unavailable. Please try again in a moment."

test("asking state", async ({ page }) => {
    await hangRequest(page, "**/api/ask", "POST")
    await page.goto("/")
    await askQuestion(page)

    await expect(page.getByRole("button", { name: "Asking…" })).toBeDisabled()
    await expect(
        page.getByRole("textbox", { name: "Question" }),
    ).toHaveAttribute("readonly")
    await expect(page.getByText("Looking through your meetings…")).toBeVisible()
})

test("answered state", async ({ page }) => {
    await answerRequest(page, "**/api/ask", "POST", ANSWER)
    await page.goto("/")
    await askQuestion(page)

    await expect(page.getByText("Answer ready.")).toBeVisible()
    await expect(page.getByText("Based on: Weekly sync")).toBeVisible()
    await expect(page.locator("#ask")).toHaveScreenshot("answered.png")
})

test("error state keeps the question and offers a retry", async ({ page }) => {
    await failRequest(
        page,
        "**/api/ask",
        "POST",
        502,
        "LLM_UNAVAILABLE",
        UNAVAILABLE,
    )
    await page.goto("/")
    await askQuestion(page)

    await expect(banner(page)).toContainText("Couldn't answer that")
    await expect(banner(page)).toContainText(UNAVAILABLE)
    await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled()
    await expect(page.getByRole("textbox", { name: "Question" })).toHaveValue(
        "What's still open?",
    )
})

test("question hint: too long", async ({ page }) => {
    await page.goto("/")
    await page
        .getByRole("textbox", { name: "Question" })
        .fill("a".repeat(MAX_QUESTION_LENGTH + 1))

    await expect(
        page.getByText(`Questions are limited to ${MAX_QUESTION_LENGTH}`),
    ).toBeVisible()
    await expect(
        page.getByRole("button", { name: "Ask", exact: true }),
    ).toBeDisabled()
})

test("the header button scrolls to the ask card", async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the button is mobile only")
    await page.goto("/")
    await page.getByRole("link", { name: "Ask about your meetings" }).click()

    await expect(page.locator("#ask")).toBeInViewport()
})
