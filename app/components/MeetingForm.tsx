import type { SubmitEvent } from "react"
import type { CreatePhase } from "@/app/hooks"
import type { ApiError } from "@/app/lib/apiClient"
import { createMeetingSchema } from "@/lib/schemas"
import { fieldMessages } from "@/lib/zodFields"
import { WarningIcon } from "./icons"
import { Spinner } from "./Spinner"

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

type MeetingFormProps = {
    title: string
    notes: string
    phase: CreatePhase
    error: ApiError | null
    announcement: string
    onTitleChange: (value: string) => void
    onNotesChange: (value: string) => void
    onSubmit: () => void
}

export function MeetingForm({
    title,
    notes,
    phase,
    error,
    announcement,
    onTitleChange,
    onNotesChange,
    onSubmit,
}: MeetingFormProps) {
    const isProcessing = phase === "processing"

    const parsed = createMeetingSchema.safeParse({ title, notes })
    const clientErrors = parsed.success ? {} : fieldMessages(parsed.error)
    const serverErrors =
        error?.code === "VALIDATION_ERROR" ? (error.fields ?? {}) : {}
    const titleError = clientErrors.title ?? serverErrors.title
    const notesError =
        (notes.trim() ? clientErrors.notes : undefined) ?? serverErrors.notes
    const showBanner =
        error !== null && !(serverErrors.title ?? serverErrors.notes)

    const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault()
        if (parsed.success && !isProcessing) {
            onSubmit()
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
                    <p className="text-sm text-pretty text-muted">
                        Paste your notes as they are. Action items are pulled
                        out for you.
                    </p>
                </div>

                <div className="flex flex-col gap-[6px]">
                    <label
                        htmlFor="meeting-title"
                        className="text-sm font-medium"
                    >
                        Title{" "}
                        <span className="font-normal text-muted">
                            (optional)
                        </span>
                    </label>
                    <input
                        id="meeting-title"
                        type="text"
                        className="field"
                        placeholder="Weekly product sync"
                        autoComplete="off"
                        value={title}
                        readOnly={isProcessing}
                        aria-invalid={Boolean(titleError)}
                        aria-describedby={titleError ? "title-hint" : undefined}
                        onChange={(event) => onTitleChange(event.target.value)}
                    />
                    {titleError && (
                        <p id="title-hint" className="text-sm text-muted">
                            {titleError}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-[6px]">
                    <label
                        htmlFor="meeting-notes"
                        className="text-sm font-medium"
                    >
                        Notes
                    </label>
                    <textarea
                        id="meeting-notes"
                        className="field min-h-[240px] resize-y"
                        placeholder="Paste or type meeting notes…"
                        value={notes}
                        readOnly={isProcessing}
                        aria-invalid={Boolean(notesError)}
                        aria-describedby={notesError ? "notes-hint" : undefined}
                        onChange={(event) => onNotesChange(event.target.value)}
                    />
                    {notesError && (
                        <p id="notes-hint" className="text-sm text-muted">
                            {notesError}
                        </p>
                    )}
                </div>

                {showBanner && <ErrorBanner message={error.message} />}

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={!parsed.success || isProcessing}
                    aria-busy={isProcessing}
                >
                    {isProcessing && <Spinner tone="light" />}
                    {SUBMIT_LABELS[phase]}
                </button>

                <p
                    aria-live="polite"
                    className="min-h-[21px] text-sm text-muted"
                >
                    {PHASE_MESSAGES[phase] ?? announcement}
                </p>
            </form>
        </aside>
    )
}

function ErrorBanner({ message }: { message: string }) {
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
                <span className="text-sm text-pretty">
                    {message} Your notes are still here.
                </span>
            </div>
        </div>
    )
}
