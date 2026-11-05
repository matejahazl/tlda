import { useDeleteMeeting } from "@/app/hooks"
import { pluralize } from "@/app/lib/format"
import { Dialog } from "./Dialog"

type DeleteMeetingDialogProps = {
    meetingId: number
    title: string
    itemCount: number
    open: boolean
    onCancel: () => void
    onDeleted: () => void
}

export function DeleteMeetingDialog({
    meetingId,
    title,
    itemCount,
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
            description={`"${title}" and its ${pluralize(itemCount, "action item")} will be permanently deleted. This can't be undone.`}
            confirmLabel="Delete meeting"
            pendingLabel="Deleting…"
            errorTitle="Couldn't delete this meeting"
            errorMessage={error?.message ?? null}
            onConfirm={() => void remove(meetingId)}
            onCancel={() => {
                reset()
                onCancel()
            }}
        />
    )
}
