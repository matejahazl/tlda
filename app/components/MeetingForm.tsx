import { type SubmitEvent, useState } from "react"
import { usePlanner } from "@/app/context"
import type { CreatePhase } from "@/app/hooks"
import { pluralize } from "@/app/lib/format"
import { createMeetingSchema, fieldMessages } from "@/lib/schemas"
import { WarningIcon } from "./icons"
import { Button, Textarea, TextInput } from "./ui"

const SUBMIT_LABELS: Record<CreatePhase, string> = {
    idle: "Extract action items",
    processing: "Extracting…",
    error: "Try again",
}

const PHASE_MESSAGES: Record<CreatePhase, string | null> = {
    idle: null,
    processing: "Reading your notes and pulling out action items…",
    error: "Extraction failed.",
}

export function MeetingForm() {
    const { extractPhase, extractError, extractMeeting, clearExtractError } =
        usePlanner()
    const [title, setTitle] = useState("")
    const [notes, setNotes] = useState("")
    const [announcement, setAnnouncement] = useState("")
    const isExtracting = extractPhase === "processing"

    const parsed = createMeetingSchema.safeParse({ title, notes })
    const clientErrors = parsed.success ? {} : fieldMessages(parsed.error)
    const serverErrors =
        extractError?.code === "VALIDATION_ERROR"
            ? (extractError.fields ?? {})
            : {}
    const titleError = clientErrors.title ?? serverErrors.title
    const notesError =
        (notes.trim() ? clientErrors.notes : undefined) ?? serverErrors.notes
    const showBanner =
        extractError !== null && !(serverErrors.title ?? serverErrors.notes)

    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault()
        if (!parsed.success || isExtracting) {
            return
        }

        setAnnouncement("")
        const meeting = await extractMeeting({ title, notes })

        if (meeting) {
            setTitle("")
            setNotes("")
            setAnnouncement(
                `Added ${meeting.title} with ${pluralize(meeting.items.length, "action item")}.`,
            )
        }
    }

    return (
        <aside
            id="meeting-form"
            aria-label="Add meeting notes"
            className="min-w-0 flex-[1_1_360px] rounded-[16px] bg-card p-[24px] shadow-card"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-[4px]">
                    <h2 className="text-heading">New meeting notes</h2>
                    <p className="text-meta text-pretty">
                        Paste your notes as they are. Action items are pulled
                        out for you.
                    </p>
                </div>

                <TextInput
                    id="meeting-title"
                    label={
                        <>
                            Title <span className="text-meta">(optional)</span>
                        </>
                    }
                    placeholder="Weekly product sync"
                    autoComplete="off"
                    value={title}
                    readOnly={isExtracting}
                    error={titleError}
                    onChange={(event) => {
                        setTitle(event.target.value)
                        clearExtractError()
                    }}
                />

                <Textarea
                    id="meeting-notes"
                    label="Notes"
                    placeholder="Paste or type meeting notes…"
                    value={notes}
                    readOnly={isExtracting}
                    error={notesError}
                    onChange={(event) => {
                        setNotes(event.target.value)
                        clearExtractError()
                    }}
                />

                {showBanner && <ErrorBanner message={extractError.message} />}

                <Button
                    type="submit"
                    disabled={!parsed.success}
                    pending={isExtracting}
                >
                    {SUBMIT_LABELS[extractPhase]}
                </Button>

                <p aria-live="polite" className="min-h-[21px] text-meta">
                    {PHASE_MESSAGES[extractPhase] ?? announcement}
                </p>
            </form>
        </aside>
    )
}

type ErrorBannerProps = {
    message: string
}

function ErrorBanner({ message }: ErrorBannerProps) {
    return (
        <div
            role="alert"
            className="flex gap-[12px] rounded-[12px] bg-danger p-[16px] text-danger-ink shadow-danger"
        >
            <WarningIcon className="size-[20px] flex-none translate-y-[2px]" />
            <div className="flex flex-col gap-[2px]">
                <strong className="font-semibold">
                    Couldn&apos;t extract action items
                </strong>
                <span className="text-meta text-pretty text-danger-ink">
                    {message} Your notes are still here.
                </span>
            </div>
        </div>
    )
}
