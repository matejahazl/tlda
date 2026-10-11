import type { ComponentType } from "react"
import type { ItemStatus } from "@/types"
import { DoneIcon, InProgressIcon, OpenIcon } from "./icons"

const STATUS_OPTIONS: {
    value: ItemStatus
    label: string
    selected: string
}[] = [
    { value: "open", label: "Open", selected: "bg-open text-open-ink" },
    {
        value: "in_progress",
        label: "In progress",
        selected: "bg-progress text-progress-ink",
    },
    { value: "done", label: "Done", selected: "bg-done text-done-ink" },
]

const STATUS_ICONS: Record<
    ItemStatus,
    ComponentType<{ className?: string }>
> = {
    open: OpenIcon,
    in_progress: InProgressIcon,
    done: DoneIcon,
}

type StatusButtonsProps = {
    status: ItemStatus
    itemText: string
    onChange: (status: ItemStatus) => void
}

export function StatusButtons({
    status,
    itemText,
    onChange,
}: StatusButtonsProps) {
    return (
        <div
            role="group"
            aria-label={`Status: ${itemText}`}
            className="inline-flex gap-[2px] rounded-[12px] bg-segment p-[2px]"
        >
            {STATUS_OPTIONS.map((option) => {
                const isSelected = option.value === status
                const Icon = STATUS_ICONS[option.value]
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => !isSelected && onChange(option.value)}
                        className={`inline-flex min-h-[40px] touch-manipulation items-center gap-[6px] whitespace-nowrap rounded-[10px] px-[12px] text-sm font-medium transition duration-160 ease-out motion-safe:active:scale-97 ${
                            isSelected
                                ? option.selected
                                : "text-muted hover-fine:text-ink"
                        }`}
                    >
                        <Icon className="size-[16px]" />
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
