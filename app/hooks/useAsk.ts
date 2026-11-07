import { useEffect, useRef, useState } from "react"
import { ApiError, apiFetch } from "@/app/lib/apiClient"
import type { AskAnswer } from "@/types"

export type AskPhase = "idle" | "asking" | "answered" | "error"

export function useAsk() {
    const [phase, setPhase] = useState<AskPhase>("idle")
    const [answer, setAnswer] = useState<AskAnswer | null>(null)
    const [error, setError] = useState<ApiError | null>(null)
    const controller = useRef<AbortController | null>(null)

    // aborts the request in flight on unmount
    useEffect(() => () => controller.current?.abort(), [])

    async function ask(question: string) {
        if (phase === "asking") {
            return
        }

        controller.current = new AbortController()
        setPhase("asking")
        setAnswer(null)
        setError(null)

        try {
            const result = await apiFetch<AskAnswer>("/api/ask", {
                method: "POST",
                body: { question },
                signal: controller.current.signal,
            })
            setAnswer(result)
            setPhase("answered")
        } catch (caught) {
            setError(caught instanceof ApiError ? caught : ApiError.internal())
            setPhase("error")
        }
    }

    return { phase, answer, error, ask }
}
