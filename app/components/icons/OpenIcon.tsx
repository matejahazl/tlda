import type { IconProps } from "./IconProps"

export function OpenIcon({ className }: IconProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <circle
                cx="8"
                cy="8"
                r="6.25"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </svg>
    )
}
