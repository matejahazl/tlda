import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL(".", import.meta.url)),
            "server-only": fileURLToPath(
                new URL("./tests/server-only.ts", import.meta.url),
            ),
        },
    },
    test: {
        environment: "node",
        exclude: ["tests/browser/**", "node_modules/**", ".next/**"],
        env: { LLM_PROVIDER: "mock", LOG_LEVEL: "debug" },
    },
})
