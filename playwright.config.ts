import { defineConfig } from "@playwright/test"

const PORT = 3100
const E2E_DB = "data/e2e.db"

export default defineConfig({
    testDir: "./e2e",
    workers: 1,
    use: { baseURL: `http://127.0.0.1:${PORT}` },
    projects: [
        { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
        { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    ],
    expect: { toHaveScreenshot: { animations: "disabled" } },
    webServer: {
        command: `rm -f ${E2E_DB}* && npm run build && npm run start -- -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        timeout: 180_000,
        reuseExistingServer: false,
        env: { DB_PATH: E2E_DB, LLM_PROVIDER: "mock", LOG_LEVEL: "error" },
    },
})
