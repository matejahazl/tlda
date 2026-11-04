"use client"

import { useState } from "react"
import { useCreateMeeting, useSetItemStatus } from "@/app/hooks"
import { pluralize } from "@/app/lib/format"
import { patchItem } from "@/app/lib/meetings"
import type { Meeting, PaginatedMeetings } from "@/types"
import { MeetingForm } from "./MeetingForm"
import { MeetingList } from "./MeetingList"

export function Planner({ initialPage }: { initialPage: PaginatedMeetings }) {
    const [savedMeetings, setSavedMeetings] = useState(initialPage.meetings)
    const [nextCursor, setNextCursor] = useState(initialPage.nextCursor)

    const [announcement, setAnnouncement] = useState("")

    function handleCreated(meeting: Meeting) {
        setSavedMeetings((current) => [meeting, ...current])
        setAnnouncement(
            `Added ${meeting.title} with ${pluralize(meeting.items.length, "action item")}.`,
        )
    }
    function handleDeleted(meeting: Meeting) {
        setSavedMeetings((current) =>
            current.filter(({ id }) => id !== meeting.id),
        )
        setAnnouncement(`Deleted ${meeting.title}.`)
    }
    function handleLoaded(page: PaginatedMeetings) {
        setSavedMeetings((current) => [...current, ...page.meetings])
        setNextCursor(page.nextCursor)
        // the running count makes each message differ, so repeats are announced again
        setAnnouncement(
            `Loaded ${pluralize(page.meetings.length, "more meeting")}, ${savedMeetings.length + page.meetings.length} meetings now shown.`,
        )
    }
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
                </div>
                <a className="btn-primary lg:hidden" href="#meeting-form">
                    New meeting notes
                </a>
            </header>
            <main className="mx-auto flex max-w-page flex-wrap items-start gap-[32px] px-[32px] pb-[72px]">
                <MeetingList
                    meetings={meetings}
                    isExtracting={phase === "processing"}
                    onSetStatus={setItemStatus}
                    onDeleted={handleDeleted}
                    nextCursor={nextCursor}
                    onLoaded={handleLoaded}
                />
                <MeetingForm
                    phase={phase}
                    error={error}
                    announcement={announcement}
                    onEdit={reset}
                    onSubmit={(body) => {
                        setAnnouncement("")
                        return submit(body)
                    }}
                />
            </main>
        </>
    )
}
