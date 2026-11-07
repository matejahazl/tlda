import { defineConfig } from "@playwright/test"

const PORT = 3100
const BROWSER_DB = "data/browser.db"

export default defineConfig({
    testDir: "./tests/browser",
    workers: 1,
    use: { baseURL: `http://127.0.0.1:${PORT}` },
    projects: [
        { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
        { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    ],
    expect: {
        toHaveScreenshot: {
            animations: "disabled",
            stylePath: "tests/browser/screenshot.css",
        },
    },
    webServer: {
        command: `rm -f ${BROWSER_DB}* && npm run build && npm run start -- -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        timeout: 180_000,
        reuseExistingServer: false,
        env: { DB_PATH: BROWSER_DB, LLM_PROVIDER: "mock", LOG_LEVEL: "error" },
    },
})
