import "server-only"
import { MAX_ITEM_TEXT_LENGTH, MAX_ITEMS } from "@/lib/schemas"
import { LlmProvider } from "../LlmProvider"
import type {
    ChatRequest,
    ChatResponse,
    CompleteRequest,
    CompleteResponse,
} from "../types"

type MockCompleteReply = string | CompleteResponse
export type MockCompleteHandler = (
    request: CompleteRequest,
    opts: { signal: AbortSignal },
) => MockCompleteReply | Promise<MockCompleteReply>

type ChatReply = ChatResponse["reply"]
export type MockChatStep =
    | ChatReply
    | ((
          request: ChatRequest,
          opts: { signal: AbortSignal },
      ) => ChatReply | Promise<ChatReply>)

const ACTION_LINE = /\b(will|should|needs? to|todo|action)\b/i // offline dev: lines that sound like a task

type MockFakes = {
    complete?: MockCompleteHandler
    chat?: MockChatStep[] // one step per call, in order
}

// Tests pass fakes to script any reply or failure. Without them it fakes plausible replies.
export class MockProvider extends LlmProvider {
    private turn = 0

    constructor(private readonly fakes: MockFakes = {}) {
        super()
    }

    async complete(request: CompleteRequest, opts: { signal: AbortSignal }) {
        const fake = this.fakes.complete ?? extractFromLines
        const reply = await fake(request, opts)

        return typeof reply === "string" ? { text: reply } : reply
    }

    async chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse> {
        const step = this.fakes.chat
            ? this.fakes.chat[this.turn++]
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

function extractFromLines(request: CompleteRequest): string {
    const items = request.user
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => ACTION_LINE.test(line))
        .slice(0, MAX_ITEMS) // stay within the extraction limits
        .map((line) => ({ text: line.slice(0, MAX_ITEM_TEXT_LENGTH) }))

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
