import "server-only"
import { z } from "zod"

const LLM_PROVIDERS = ["gemini", "openai-compatible", "mock"] as const
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value)
const optionalString = z.preprocess(blankToUndefined, z.string().optional())
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional())

const envSchema = z
    .object({
        LLM_PROVIDER: z.enum(LLM_PROVIDERS),
        LLM_MODEL: optionalString,
        LLM_API_KEY: optionalString,
        LLM_BASE_URL: optionalUrl,
        LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    })
    .superRefine((value, ctx) => {
        const required = [
            { name: "LLM_MODEL", when: value.LLM_PROVIDER !== "mock" },
            { name: "LLM_API_KEY", when: value.LLM_PROVIDER !== "mock" },
            {
                name: "LLM_BASE_URL",
                when: value.LLM_PROVIDER === "openai-compatible",
            },
        ] as const
        for (const { name, when } of required) {
            if (when && !value[name]) {
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
