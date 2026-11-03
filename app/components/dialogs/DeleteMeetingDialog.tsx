import { useDeleteMeeting } from "@/app/hooks"
import { pluralize } from "@/app/lib/format"
import type { Meeting } from "@/types"
import { Dialog } from "./Dialog"

type DeleteMeetingDialogProps = {
    meeting: Meeting
    open: boolean
    onCancel: () => void
    onDeleted: (meeting: Meeting) => void
}

export function DeleteMeetingDialog({
    meeting,
    open,
    onCancel,
    onDeleted,
}: DeleteMeetingDialogProps) {
    const { pending, error, remove, reset } = useDeleteMeeting(onDeleted)

    return (
        <Dialog
            open={open}
            pending={pending}
            title="Delete this meeting?"
            description={`"${meeting.title}" and its ${pluralize(meeting.items.length, "action item")} will be permanently deleted. This can't be undone.`}
            confirmLabel="Delete meeting"
            pendingLabel="Deleting…"
            error={
                error && {
                    title: "Couldn't delete this meeting",
                    message: error.message,
                }
            }
            onConfirm={() => void remove(meeting)}
            onCancel={() => {
                reset()
                onCancel()
            }}
        />
    )
}
