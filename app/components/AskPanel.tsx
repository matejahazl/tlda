import { type SubmitEvent, useState } from "react"
import { type AskPhase, useAsk } from "@/app/hooks"
import type { AskAnswer } from "@/lib/shared"
import { askSchema, fieldMessages } from "@/lib/shared"
import { Button, ErrorBanner, TextInput } from "./ui"

const SUBMIT_LABELS: Record<AskPhase, string> = {
    idle: "Ask",
    asking: "Asking…",
    answered: "Ask",
    error: "Try again",
}

const PHASE_MESSAGES: Record<AskPhase, string> = {
    idle: "",
    asking: "Looking through your meetings…",
    answered: "Answer ready.",
    error: "Couldn't answer that.",
}

const SKELETON_WIDTHS = ["w-11/12", "w-4/5", "w-3/5"] // one per placeholder line

export function AskPanel() {
    const { phase, answer, error, ask } = useAsk()
    const [question, setQuestion] = useState("")
    const isAsking = phase === "asking"

    const parsed = askSchema.safeParse({ question })
    const clientError = parsed.success
        ? undefined
        : fieldMessages(parsed.error).question
    const serverError =
        error?.code === "VALIDATION_ERROR" ? error.fields?.question : undefined
    const questionError =
        (question.trim() ? clientError : undefined) ?? serverError

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
                    readOnly={isAsking}
                    error={questionError}
                    onChange={(event) => setQuestion(event.target.value)}
                />

                <Button
                    type="submit"
                    disabled={!parsed.success}
                    pending={isAsking}
                >
                    {SUBMIT_LABELS[phase]}
                </Button>

                {isAsking && <AnswerSkeleton />}

                {error && !serverError && (
                    <ErrorBanner
                        title="Couldn't answer that"
                        message={error.message}
                    />
                )}

                {phase === "answered" && answer && (
                    <AnswerBox answer={answer} />
                )}

                <p aria-live="polite" className="min-h-[21px] text-meta">
                    {PHASE_MESSAGES[phase]}
                </p>
            </form>
        </section>
    )
}

function AnswerSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="flex flex-col gap-[10px] rounded-[12px] bg-bg p-[16px]"
        >
            {SKELETON_WIDTHS.map((width) => (
                <div
                    key={width}
                    className={`h-[14px] rounded-[7px] bg-skeleton motion-safe:animate-pulse-soft ${width}`}
                />
            ))}
        </div>
    )
}

type AnswerBoxProps = {
    answer: AskAnswer
}

function AnswerBox({ answer }: AnswerBoxProps) {
    return (
        <div className="flex flex-col gap-[10px] rounded-[12px] bg-bg p-[16px] motion-safe:animate-enter motion-reduce:animate-fade">
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
