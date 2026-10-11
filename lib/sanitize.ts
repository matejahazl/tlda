const CONTROL_CHARS = /(?![\t\n])\p{Cc}/gu // every control character except tab and newline

export function cleanText(value: string): string {
    return value.replace(CONTROL_CHARS, "").trim()
}

export function isSingleLine(value: string): boolean {
    return !/[\r\n]/.test(value)
}
