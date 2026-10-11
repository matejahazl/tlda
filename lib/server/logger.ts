import "server-only"
import type { DestinationStream, Logger } from "pino"
import pino from "pino"
import { env } from "@/lib/server/env"

const REDACTED_KEYS = [
    "apiKey",
    "authorization",
    "cookie",
    "LLM_API_KEY",
    "headers.authorization",
    "headers.cookie",
]

const globalForLogger = globalThis as typeof globalThis & { __logger?: Logger }

export function createLogger(destination?: DestinationStream): Logger {
    return pino(
        {
            level: env.LOG_LEVEL,
            redact: {
                paths: [
                    ...REDACTED_KEYS,
                    ...REDACTED_KEYS.map((k) => `*.${k}`),
                ],
                censor: "[redacted]",
            },
        },
        destination,
    )
}

export const logger = (globalForLogger.__logger ??= createLogger())
