import type { ItemStatus, Meeting } from "@/types"
import { MeetingCard } from "./MeetingCard"
import { SkeletonCard } from "./SkeletonCard"

type MeetingListProps = {
    meetings: Meeting[]
    pendingTitle: string | null
    onSetStatus: (itemId: number, status: ItemStatus) => void
    onDeleted: (meeting: Meeting) => void
}

export function MeetingList({
    meetings,
    pendingTitle,
    onSetStatus,
    onDeleted,
}: MeetingListProps) {
    return (
        <section
            aria-label="Meetings"
            className="flex min-w-0 flex-[999_1_560px] flex-col gap-[20px]"
        >
            {pendingTitle !== null && <SkeletonCard title={pendingTitle} />}
            {meetings.map((meeting) => (
                <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onSetStatus={onSetStatus}
                    onDeleted={onDeleted}
                />
            ))}
            {meetings.length === 0 && pendingTitle === null && (
                <div className="flex flex-col items-center gap-[6px] rounded-[16px] px-[32px] py-[56px] text-center shadow-field">
                    <h2 className="text-heading">No meetings yet</h2>
                    <p className="max-w-[320px] text-pretty text-muted">
                        Paste your meeting notes and the action items will show
                        up here, ready to track.
                    </p>
                </div>
            )}
        </section>
    )
}
