export function WarningIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M10 2.5l8 14H2l8-14z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
            <path
                d="M10 8v4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <circle cx="10" cy="14.2" r="1" fill="currentColor" />
        </svg>
    )
}
