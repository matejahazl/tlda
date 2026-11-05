import { useState } from "react"
import { usePlanner } from "@/app/context"
import { useSetItemStatus } from "@/app/hooks"
import { countDone, formatDate } from "@/app/lib/format"
import type { Meeting } from "@/types"
import { DeleteMeetingDialog } from "./dialogs"
import { TrashIcon } from "./icons"
import { Button, StatusButtons } from "./ui"

const LEAVE_DURATION_MS = 200 // matches the leave animation

type MeetingCardProps = {
    meeting: Meeting
}

export function MeetingCard({ meeting: savedMeeting }: MeetingCardProps) {
    const { updateActionItem, removeMeeting } = usePlanner()
    const { meeting, setItemStatus } = useSetItemStatus(
        savedMeeting,
        updateActionItem,
    )
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [leaving, setLeaving] = useState(false)

    function handleDeleted() {
        setIsDialogOpen(false)
        setLeaving(true)
        // let the exit animation play, then let the list drop the card
        setTimeout(() => removeMeeting(meeting), LEAVE_DURATION_MS)
    }
    const done = countDone(meeting)
    const total = meeting.items.length

    return (
        <>
            <article
                className={`overflow-hidden rounded-[16px] bg-card shadow-card ${
                    leaving
                        ? "pointer-events-none motion-safe:animate-leave motion-reduce:opacity-0"
                        : "motion-safe:animate-enter motion-reduce:animate-fade"
                }`}
            >
                <div className="flex flex-wrap items-center justify-between gap-x-[24px] gap-y-[12px] px-[24px] py-[20px]">
                    <div className="flex min-w-0 flex-col">
                        <h2 className="wrap-anywhere">{meeting.title}</h2>
                        <time
                            dateTime={meeting.createdAt}
                            suppressHydrationWarning // if client and server tz differs
                            className="text-meta"
                        >
                            {formatDate(meeting.createdAt)}
                        </time>
                    </div>
                    <div className="flex items-center gap-[12px]">
                        <span className="text-meta tabular-nums">
                            {`${done} of ${total} done`}
                        </span>
                        <ProgressBar ratio={total ? done / total : 0} />
                        <Button
                            variant="delete"
                            size="icon"
                            aria-label={`Delete meeting: ${meeting.title}`}
                            onClick={() => setIsDialogOpen(true)}
                        >
                            <TrashIcon className="size-[20px]" />
                        </Button>
                    </div>
                </div>
                <ul>
                    {meeting.items.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-x-[24px] gap-y-[12px] border-t-[1px] border-line px-[24px] py-[14px]"
                        >
                            <span
                                className={`min-w-0 flex-[1_1_240px] transition-colors duration-200 wrap-anywhere ${
                                    item.status === "done"
                                        ? "text-muted line-through decoration-strike"
                                        : ""
                                }`}
                            >
                                {item.text}
                            </span>
                            <StatusButtons
                                status={item.status}
                                label={`Status: ${item.text}`}
                                onChange={(status) =>
                                    setItemStatus(item.id, status)
                                }
                            />
                        </li>
                    ))}
                </ul>
            </article>
            <DeleteMeetingDialog
                meeting={meeting}
                open={isDialogOpen}
                onCancel={() => setIsDialogOpen(false)}
                onDeleted={handleDeleted}
            />
        </>
    )
}

type ProgressBarProps = {
    ratio: number
}

function ProgressBar({ ratio }: ProgressBarProps) {
    return (
        <div
            aria-hidden="true"
            className="h-[6px] w-[80px] overflow-hidden rounded-full bg-track"
        >
            <div
                className="size-full origin-left rounded-full bg-done-fill transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${ratio})` }}
            />
        </div>
    )
}
