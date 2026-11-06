import "server-only"
import type { AskAnswer } from "@/types"

export class AskService {
    // shortcut: fixed answer until the tools and agent loop are wired in (build steps 4-12)
    async ask(_question: string): Promise<AskAnswer> {
        return { answer: "stub", sources: [] }
    }
}
