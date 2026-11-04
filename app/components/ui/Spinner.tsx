export type SpinnerTone = "light" | "dark"

type SpinnerSize = "sm" | "md"

type SpinnerProps = {
    tone: SpinnerTone
    size?: SpinnerSize
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
    sm: "size-[16px]",
    md: "size-[20px]",
}

const TONE_CLASSES: Record<SpinnerTone, string> = {
    light: "border-on-accent/35 border-t-on-accent",
    dark: "border-ink/20 border-t-accent",
}

export function Spinner({ tone, size = "sm" }: SpinnerProps) {
    return (
        <span
            aria-hidden="true"
            className={`inline-block shrink-0 animate-spin-fast rounded-full border-[2px] motion-reduce:animate-spin-slow ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]}`}
        />
    )
}
