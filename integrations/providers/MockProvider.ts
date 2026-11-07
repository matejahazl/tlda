import "server-only"
import type {
    ChatRequest,
    ChatResponse,
    LlmProvider,
    LlmRequest,
    LlmResponse,
} from "../types"

type MockCompleteReply = string | LlmResponse
type MockCompleteHandler = (
    request: LlmRequest,
    opts: { signal: AbortSignal },
) => MockCompleteReply | Promise<MockCompleteReply>

type ChatReply = ChatResponse["reply"]
// A fixed reply, or a function to inspect the request, throw or wait for the abort
export type MockChatStep =
    | ChatReply
    | ((
          request: ChatRequest,
          opts: { signal: AbortSignal },
      ) => ChatReply | Promise<ChatReply>)

const ACTION_LINE = /\b(will|should|needs? to|todo|action)\b/i // offline dev: lines that sound like a task
const MAX_MOCK_ITEMS = 30 // keeps the offline output valid

// Tests pass a handler (extraction) or a script (ask) to fake any reply or failure. Without them it fakes plausible replies.
export class MockProvider implements LlmProvider {
    private turn = 0

    constructor(
        private readonly completeHandler: MockCompleteHandler = extractFromLines,
        private readonly chatScript?: MockChatStep[],
    ) {}

    async complete(request: LlmRequest, opts: { signal: AbortSignal }) {
        const reply = await this.completeHandler(request, opts)
        return typeof reply === "string" ? { text: reply } : reply
    }

    // One scripted step per call, in order
    async chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse> {
        const step = this.chatScript
            ? this.chatScript[this.turn++]
            : searchOpenItems
        if (!step) {
            throw new Error(
                `MockProvider: no scripted reply for turn ${this.turn}`,
            )
        }
        const reply =
            typeof step === "function" ? await step(request, opts) : step
        return { reply, raw: JSON.stringify(reply) }
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

// Search the open items, then answer, so the whole loop runs without a key
function searchOpenItems(request: ChatRequest): ChatReply {
    if (request.messages.at(-1)?.role !== "tool") {
        return {
            kind: "tool_calls",
            calls: [
                {
                    id: "mock-1",
                    name: "search_items",
                    args: { status: "open" },
                },
            ],
        }
    }
    return {
        kind: "text",
        text: "Mock answer: these are your open items (offline mock, no real model).",
    }
}
