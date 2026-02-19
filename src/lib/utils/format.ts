import { formatUnits } from "viem";

// Clamp to maxDecimals but keep the string safe for inputs
export function clampDecimals(value: string, maxDecimals: number) {
    if (!value.includes(".")) return value;
    const [i, d] = value.split(".");
    const dd = (d ?? "").slice(0, maxDecimals);
    return dd.length ? `${i}.${dd}` : i;
}

// Display helper: 4dp for >=1, 6dp for <1
export function formatTokenDisplay(raw: bigint | null | undefined, decimals: number) {
    if (raw === null || raw === undefined) return null;
    const full = formatUnits(raw, decimals);
    const n = Number(full);
    if (!Number.isFinite(n)) return clampDecimals(full, 6);
    const max = Math.abs(n) >= 1 ? 4 : 6;
    return clampDecimals(full, max);
}

// Output display: cap at 6 decimals (prevents huge noise)
export function formatOutDisplay(outFormatted: string | null | undefined) {
    if (!outFormatted) return null;
    return clampDecimals(outFormatted, 6);
}

export function formatUsd(value: number) {
    if (!Number.isFinite(value)) return null;
    const opts =
        value >= 1
            ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            : { minimumFractionDigits: 2, maximumFractionDigits: 4 };
    return `$${value.toLocaleString(undefined, opts)}`;
}

export function formatCompactUsd(n: number) {
    if (!n) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}k`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}
