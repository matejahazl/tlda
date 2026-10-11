"use client"

import { useCallback, useState } from "react"
import { useCreateMeeting, useSetItemStatus } from "@/app/hooks"
import { pluralize, summaryLine } from "@/app/lib/format"
import { patchItem } from "@/app/lib/meetings"
import type { Meeting } from "@/types"
import { MeetingForm } from "./MeetingForm"
import { MeetingList } from "./MeetingList"

const PENDING_TITLE_FALLBACK = "New meeting" // shown on the placeholder card when the user typed no title

// Holds the page state: saved meetings and the form. The server only sends the first list.
export function Planner({ initialMeetings }: { initialMeetings: Meeting[] }) {
    const [savedMeetings, setSavedMeetings] = useState(initialMeetings)
    const [title, setTitle] = useState("")
    const [notes, setNotes] = useState("")
    const [announcement, setAnnouncement] = useState("")

    const handleCreated = useCallback((meeting: Meeting) => {
        setSavedMeetings((current) => [meeting, ...current])
        setTitle("")
        setNotes("")
        setAnnouncement(
            `Added ${meeting.title} with ${pluralize(meeting.items.length, "action item")}.`,
        )
    }, [])
    const { phase, error, submit, reset } = useCreateMeeting(handleCreated)
    const { meetings, setItemStatus } = useSetItemStatus(
        savedMeetings,
        (item) =>
            setSavedMeetings((current) => patchItem(current, item.id, item)),
    )

    return (
        <>
            <header className="mx-auto flex max-w-page flex-wrap items-end justify-between gap-[16px] px-[32px] pb-[28px] pt-[48px]">
                <div className="flex flex-col gap-[6px]">
                    <h1>TL;DA</h1>
                    <p className="text-tagline text-muted">
                        Too long; do actions.
                    </p>
                    <p className="pt-[6px]">
                        Paste your meeting notes and get the to-dos.
                    </p>
                    <p className="text-muted">{summaryLine(meetings)}</p>
                </div>
                <a className="btn-primary lg:hidden" href="#meeting-form">
                    New meeting notes
                </a>
            </header>
            <main className="mx-auto flex max-w-page flex-wrap items-start gap-[32px] px-[32px] pb-[72px]">
                <MeetingList
                    meetings={meetings}
                    pendingTitle={
                        phase === "processing"
                            ? title.trim() || PENDING_TITLE_FALLBACK
                            : null
                    }
                    onSetStatus={setItemStatus}
                />
                <MeetingForm
                    title={title}
                    notes={notes}
                    phase={phase}
                    error={error}
                    announcement={announcement}
                    onTitleChange={(value) => {
                        setTitle(value)
                        reset()
                    }}
                    onNotesChange={(value) => {
                        setNotes(value)
                        reset()
                    }}
                    onSubmit={() => {
                        setAnnouncement("")
                        void submit({ title, notes })
                    }}
                />
            </main>
        </>
    )
}
