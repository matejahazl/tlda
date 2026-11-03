import type { ComponentProps } from "react"
import { Spinner } from "./Spinner"

type ButtonVariant = "primary" | "primary-danger" | "secondary" | "delete"

type ButtonSize = "md" | "sm" | "icon"

type ButtonProps = Omit<ComponentProps<"button">, "className"> & {
    variant?: ButtonVariant
    pending?: boolean
} & (
        | { size?: Exclude<ButtonSize, "icon"> }
        | { size: "icon"; "aria-label": string }
    )

const BASE_CLASSES =
    "inline-flex touch-manipulation items-center justify-center transition duration-160 ease-out motion-safe:not-disabled:active:scale-97 disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:opacity-50 aria-busy:cursor-progress"

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary:
        "bg-accent text-on-accent hover-fine:not-disabled:not-aria-busy:bg-accent-hover",
    "primary-danger":
        "bg-danger-fill text-on-accent hover-fine:not-disabled:not-aria-busy:bg-danger-fill-hover",
    secondary: "bg-segment text-ink hover-fine:not-disabled:bg-segment-hover",
    delete: "text-muted hover-fine:not-disabled:bg-danger hover-fine:not-disabled:text-danger-ink",
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
    md: "min-h-[48px] gap-[10px] rounded-[12px] px-[20px] text-button",
    sm: "min-h-[40px] gap-[8px] rounded-[10px] px-[14px] text-label font-semibold",
    icon: "size-[40px] flex-none rounded-[10px]",
}

export function Button({
    variant = "primary",
    size = "md",
    pending = false,
    type = "button",
    disabled,
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            {...rest}
            type={type}
            disabled={disabled || pending}
            aria-busy={pending}
            className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`}
        >
            {/* the spinner is white, so use pending on the filled variants */}
            {pending && <Spinner tone="light" />}
            {children}
        </button>
    )
}
