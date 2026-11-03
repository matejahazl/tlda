type SpinnerTone = "light" | "dark"

const TONE_CLASSES: Record<SpinnerTone, string> = {
    light: "size-[16px] border-on-accent/35 border-t-on-accent",
    dark: "size-[20px] border-ink/20 border-t-accent",
}

export function Spinner({ tone }: { tone: SpinnerTone }) {
    return (
        <span
            aria-hidden="true"
            className={`inline-block shrink-0 animate-spin-fast rounded-full border-[2px] motion-reduce:animate-spin-slow ${TONE_CLASSES[tone]}`}
        />
    )
}
