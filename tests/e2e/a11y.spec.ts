import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import {
    clearMeetings,
    failRequest,
    fillForm,
    hangRequest,
    seedMeeting,
} from "./helpers"

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

test.beforeEach(async ({ request }) => {
    await clearMeetings(request)
})

test.describe("axe scan", () => {
    test("empty state", async ({ page }) => {
        await page.goto("/")
        await expectNoViolations(page)
    })

    test("meeting list", async ({ page, request }) => {
        await seedMeeting(request)
        await page.goto("/")
        await expectNoViolations(page)
    })

    test("short notes hint", async ({ page }) => {
        await page.goto("/")
        await page.getByRole("textbox", { name: "Notes" }).fill("Too short")
        await expect(page.getByText("Add a bit more detail")).toBeVisible()
        await expectNoViolations(page)
    })

    test("processing state", async ({ page }) => {
        await hangRequest(page, "**/api/meetings", "POST")
        await page.goto("/")
        await fillForm(page)
        await page.getByRole("button", { name: "Extract action items" }).click()
        await expect(page.getByText("Extracting action items")).toBeVisible()
        await expectNoViolations(page)
    })

    test("error state", async ({ page }) => {
        await failRequest(
            page,
            "**/api/meetings",
            "POST",
            502,
            "LLM_UNAVAILABLE",
            "The AI service is busy or unavailable. Please try again in a moment.",
        )
        await page.goto("/")
        await fillForm(page)
        await page.getByRole("button", { name: "Extract action items" }).click()
        await expect(banner(page)).toBeVisible()
        await expectNoViolations(page)
    })

    test("delete dialog", async ({ page, request }) => {
        await seedMeeting(request)
        await page.goto("/")
        await openDeleteDialog(page)
        await expectNoViolations(page)
    })

    test("delete failure", async ({ page, request }) => {
        await seedMeeting(request)
        await failRequest(
            page,
            "**/api/meetings/*",
            "DELETE",
            500,
            "INTERNAL",
            "Something went wrong on our side. Please try again.",
        )
        await page.goto("/")
        await openDeleteDialog(page)
        await page
            .getByRole("button", { name: "Delete meeting", exact: true })
            .click()
        await expect(banner(page)).toBeVisible()
        await expectNoViolations(page)
    })
})

test.describe("keyboard", () => {
    test("form fields and submit follow reading order", async ({ page }) => {
        await page.goto("/")
        await fillForm(page)
        await page.getByRole("textbox", { name: "Title" }).focus()
        await page.keyboard.press("Tab")
        await expect(page.getByRole("textbox", { name: "Notes" })).toBeFocused()
        await page.keyboard.press("Tab")
        await expect(
            page.getByRole("button", { name: "Extract action items" }),
        ).toBeFocused()
    })

    test("status buttons toggle with the keyboard", async ({
        page,
        request,
    }) => {
        await seedMeeting(request)
        await page.goto("/")
        const done = page.getByRole("button", { name: "Done" }).first()
        await done.focus()
        await page.keyboard.press("Enter")
        await expect(done).toHaveAttribute("aria-pressed", "true")
    })

    test("dialog traps focus and Esc returns it to the trigger", async ({
        page,
        request,
    }) => {
        await seedMeeting(request)
        await page.goto("/")
        const trigger = page.getByRole("button", {
            name: "Delete meeting: Weekly sync",
        })
        await trigger.focus()
        await page.keyboard.press("Enter")
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await expect(dialog.locator(":focus")).toHaveCount(1)

        // a native modal dialog can hand focus to the browser UI, but never to the page behind it
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press("Tab")
            const behindDialog = await page.evaluate(() => {
                const active = document.activeElement
                return active !== document.body && !active?.closest("dialog")
            })
            expect(behindDialog).toBe(false)
        }

        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()
        await expect(trigger).toBeFocused()
    })
})

function banner(page: Page) {
    return page.locator('[role="alert"]:not(#__next-route-announcer__)')
}

async function openDeleteDialog(page: Page) {
    await page
        .getByRole("button", { name: "Delete meeting: Weekly sync" })
        .click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    // scan after the enter animation, or axe reads mid-fade colors
    await dialog.evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished)),
    )
}

async function expectNoViolations(page: Page) {
    // finish enter and fade animations first, or axe reads mid-fade colors (looping spinners are skipped)
    await page.evaluate(() =>
        Promise.all(
            document
                .getAnimations()
                .filter(
                    (a) =>
                        a.effect?.getComputedTiming().iterations !== Infinity,
                )
                .map((a) => a.finished.catch(() => {})), // a cancelled animation rejects
        ),
    )
    const { violations } = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze()
    expect(
        violations.map(({ id, help, nodes }) => ({
            id,
            help,
            targets: nodes.map((node) => node.target),
        })),
    ).toEqual([])
}
