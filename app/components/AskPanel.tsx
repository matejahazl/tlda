import { type SubmitEvent, useState } from "react"
import { useAsk } from "@/app/hooks"
import { askSchema } from "@/lib/schemas"
import type { AskAnswer } from "@/types"
import { Button, TextInput } from "./ui"

export function AskPanel() {
    const { phase, answer, ask } = useAsk()
    const [question, setQuestion] = useState("")
    const parsed = askSchema.safeParse({ question })

    const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault()

        if (parsed.success) {
            void ask(parsed.data.question)
        }
    }

    return (
        <section
            id="ask"
            aria-labelledby="ask-title"
            className="rounded-[16px] bg-card p-[24px] shadow-card"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-[4px]">
                    <h2 id="ask-title" className="text-heading">
                        Ask about your meetings
                    </h2>
                    <p className="text-meta text-pretty">
                        Answers come from your saved meetings and action items.
                    </p>
                </div>

                <TextInput
                    id="ask-question"
                    label="Question"
                    placeholder="What's still open?"
                    autoComplete="off"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                />

                <Button type="submit" disabled={!parsed.success}>
                    Ask
                </Button>

                {phase === "answered" && answer && (
                    <AnswerBox answer={answer} />
                )}
            </form>
        </section>
    )
}

type AnswerBoxProps = {
    answer: AskAnswer
}

function AnswerBox({ answer }: AnswerBoxProps) {
    return (
        <div className="flex animate-enter flex-col gap-[10px] rounded-[12px] bg-bg p-[16px]">
            <p className="whitespace-pre-line text-pretty wrap-anywhere">
                {answer.answer}
            </p>
            {answer.sources.length > 0 && (
                <p className="text-meta wrap-anywhere">
                    Based on:{" "}
                    {answer.sources.map((source) => source.title).join(", ")}
                </p>
            )}
        </div>
    )
}
