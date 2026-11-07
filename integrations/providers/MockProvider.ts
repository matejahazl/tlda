import "server-only"
import type {
    ChatResponse,
    LlmProvider,
    LlmRequest,
    LlmResponse,
} from "../types"

type MockReply = string | LlmResponse
type MockHandler = (
    request: LlmRequest,
    opts: { signal: AbortSignal },
) => MockReply | Promise<MockReply>

const ACTION_LINE = /\b(will|should|needs? to|todo|action)\b/i // offline dev: lines that sound like a task
const MAX_MOCK_ITEMS = 30 // keeps the offline output valid

// Tests pass a handler to script any reply or failure. Without one it fakes a plausible extraction.
export class MockProvider implements LlmProvider {
    constructor(private readonly handler: MockHandler = extractFromLines) {}

    async complete(request: LlmRequest, opts: { signal: AbortSignal }) {
        const reply = await this.handler(request, opts)
        return typeof reply === "string" ? { text: reply } : reply
    }

    async chat(): Promise<ChatResponse> {
        throw new Error("MockProvider.chat is not implemented yet") // shortcut: scripted replies come in build step 7
    }
}

function extractFromLines(request: LlmRequest): string {
    const items = request.user
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => ACTION_LINE.test(line))
        .slice(0, MAX_MOCK_ITEMS)
        .map((line) => ({ text: line.slice(0, 300) }))
    return JSON.stringify({ title: "Mock meeting", items })
}
