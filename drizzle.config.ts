import { defineConfig } from "drizzle-kit"

export default defineConfig({
    dialect: "sqlite",
    schema: "./lib/server/db/schema.ts",
    out: "./drizzle",
    dbCredentials: { url: "./data/tlda.db" },
})
