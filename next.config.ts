import type { NextConfig } from "next"

const SECURITY_HEADERS = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

const nextConfig: NextConfig = {
    serverExternalPackages: ["better-sqlite3", "pino", "pino-pretty"],
    headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
}

export default nextConfig
