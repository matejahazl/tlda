import "server-only"
import { z } from "zod"

const LLM_PROVIDERS = ["gemini", "mock"] as const
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value)
const optionalString = z.preprocess(blankToUndefined, z.string().optional())

const envSchema = z
    .object({
        LLM_PROVIDER: z.enum(LLM_PROVIDERS),
        LLM_MODEL: optionalString,
        LLM_API_KEY: optionalString,
        LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
        DB_PATH: z.string().default("data/tlda.db"),
    })
    .superRefine((value, ctx) => {
        if (value.LLM_PROVIDER === "mock") {
            return
        }
        for (const name of ["LLM_MODEL", "LLM_API_KEY"] as const) {
            if (!value[name]) {
                ctx.addIssue({
                    code: "custom",
                    path: [name],
                    message: `required when LLM_PROVIDER is "${value.LLM_PROVIDER}"`,
                })
            }
        }
    })

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
    const result = envSchema.safeParse(source)
    if (result.success) {
        return result.data
    }
    const problems = result.error.issues.map(
        (issue) => `- ${issue.path.join(".")}: ${issue.message}`,
    )
    throw new Error(
        `Invalid environment configuration:\n${problems.join("\n")}`,
    )
}

export const env = parseEnv(process.env)
