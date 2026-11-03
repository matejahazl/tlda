export function TrashIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M3.5 6h13" />
            <path d="M8 6V4.5c0-.8.7-1.5 1.5-1.5h1c.8 0 1.5.7 1.5 1.5V6" />
            <path d="M5.5 6l.7 9.3c.1.8.7 1.2 1.5 1.2h4.6c.8 0 1.4-.5 1.5-1.2L14.5 6" />
            <path d="M8.5 9v4.5M11.5 9v4.5" />
        </svg>
    )
}
