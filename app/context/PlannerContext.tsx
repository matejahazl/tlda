"use client"

import { createContext, type ReactNode, use, useState } from "react"
import { type CreatePhase, useCreateMeeting } from "@/app/hooks"
import type { ApiError } from "@/app/lib/apiClient"
import { pluralize } from "@/app/lib/format"
import { patchItem } from "@/app/lib/meetings"
import type { ActionItem, CreateMeetingBody, Meeting } from "@/types"

type PlannerContextValue = {
    meetings: Meeting[]
    listAnnouncement: string
    extractPhase: CreatePhase
    extractError: ApiError | null
    extractMeeting: (body: CreateMeetingBody) => Promise<Meeting | null>
    clearExtractError: () => void
    updateActionItem: (item: ActionItem) => void
    removeMeeting: (meeting: Meeting) => void
    appendMeetings: (meetings: Meeting[]) => void
}

type PlannerProviderProps = {
    initialMeetings: Meeting[]
    children: ReactNode
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

export function PlannerProvider({
    initialMeetings,
    children,
}: PlannerProviderProps) {
    const [meetings, setMeetings] = useState(initialMeetings)
    const [listAnnouncement, setListAnnouncement] = useState("")

    const { phase, error, submit, reset } = useCreateMeeting((meeting) =>
        setMeetings((current) => [meeting, ...current]),
    )

    function updateActionItem(item: ActionItem) {
        setMeetings((current) =>
            current.map((meeting) =>
                meeting.id === item.meetingId
                    ? patchItem(meeting, item.id, item)
                    : meeting,
            ),
        )
    }

    function removeMeeting(meeting: Meeting) {
        setMeetings((current) => current.filter(({ id }) => id !== meeting.id))
        setListAnnouncement(`Deleted ${meeting.title}.`)
    }

    function appendMeetings(loaded: Meeting[]) {
        setMeetings((current) => [...current, ...loaded])
        setListAnnouncement(
            `Loaded ${pluralize(loaded.length, "more meeting")}, ${meetings.length + loaded.length} meetings now shown.`,
        )
    }

    // No useMemo: the value only changes when this provider re-renders, which happens only on
    // its own state changes, and those are exactly when consumers need the new value.
    return (
        <PlannerContext
            value={{
                meetings,
                listAnnouncement,
                extractPhase: phase,
                extractError: error,
                extractMeeting: submit,
                clearExtractError: reset,
                updateActionItem,
                removeMeeting,
                appendMeetings,
            }}
        >
            {children}
        </PlannerContext>
    )
}

export function usePlanner(): PlannerContextValue {
    const value = use(PlannerContext)
    if (!value) {
        throw new Error("usePlanner must be used inside PlannerProvider")
    }
    return value
}
