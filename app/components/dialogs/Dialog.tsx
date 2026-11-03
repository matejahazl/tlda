import { useEffect, useId, useRef } from "react"
import { WarningIcon } from "../icons"
import { Button } from "../ui"

export type DialogProps = {
    open: boolean
    pending: boolean // the action is running; the dialog can't be dismissed
    title: string
    description: string
    confirmLabel: string
    pendingLabel: string
    error: { title: string; message: string } | null
    onConfirm: () => void
    onCancel: () => void
}

export function Dialog({
    open,
    pending,
    title,
    description,
    confirmLabel,
    pendingLabel,
    error,
    onConfirm,
    onCancel,
}: DialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const titleId = useId()
    const descriptionId = useId()

    useEffect(() => {
        const dialog = dialogRef.current
        if (open && !dialog?.open) {
            dialog?.showModal()
        } else if (!open && dialog?.open) {
            dialog.close()
        }
    }, [open])

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="m-auto w-[min(420px,calc(100vw-32px))] rounded-[16px] bg-card p-0 text-ink shadow-dialog backdrop:bg-ink/45 open:animate-pop motion-reduce:open:animate-fade"
            onCancel={(event) => {
                event.preventDefault()
                if (!pending) {
                    onCancel()
                }
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget && !pending) {
                    onCancel()
                }
            }}
        >
            <div className="flex flex-col gap-[20px] p-[24px]">
                <div className="flex flex-col gap-[6px]">
                    <h2 id={titleId} className="text-heading">
                        {title}
                    </h2>
                    <p
                        id={descriptionId}
                        className="text-pretty text-muted wrap-anywhere"
                    >
                        {description}
                    </p>
                </div>
                {error && <DialogError {...error} />}
                <div className="flex flex-wrap justify-end gap-[8px]">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    {/* TODO: take the confirm button variant as a prop */}
                    <Button
                        variant="primary-danger"
                        size="sm"
                        pending={pending}
                        onClick={onConfirm}
                    >
                        {pending ? pendingLabel : confirmLabel}
                    </Button>
                </div>
            </div>
        </dialog>
    )
}

function DialogError({ title, message }: { title: string; message: string }) {
    return (
        <div
            role="alert"
            className="flex gap-[12px] rounded-[12px] bg-danger p-[16px] text-danger-ink shadow-danger"
        >
            <WarningIcon className="size-[20px] flex-none translate-y-[2px]" />
            <div className="flex flex-col gap-[2px]">
                <strong className="font-semibold">{title}</strong>
                <span className="text-meta text-pretty text-danger-ink">
                    {message}
                </span>
            </div>
        </div>
    )
}
