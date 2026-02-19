export type UnknownErr = { shortMessage?: string; message?: string };

export function errToMessage(err: unknown, fallback: string) {
    if (!err) return fallback;

    const raw =
        typeof err === "string"
            ? err
            : typeof err === "object"
              ? (() => {
                    const e = err as UnknownErr;
                    return e.shortMessage || e.message || fallback;
                })()
              : fallback;

    const msg = String(raw || fallback);
    const m = msg.toLowerCase();

    if (
        m.includes("user rejected") ||
        m.includes("user denied") ||
        m.includes("rejected the request") ||
        m.includes("request rejected")
    ) {
        return "Transaction rejected in wallet.";
    }

    if (
        m.includes("insufficient_output_amount") ||
        m.includes("too little received") ||
        m.includes("slippage") ||
        m.includes("price moved")
    ) {
        return "Price moved too much for this swap. Try a smaller amount.";
    }

    if (
        m.includes("transfer_from_failed") ||
        m.includes("transfer from failed") ||
        m.includes("transfer amount exceeds allowance")
    ) {
        return "Token transfer failed. Check approval and balance.";
    }

    if (m.includes("expired") || m.includes("deadline")) {
        return "Transaction expired. Try again.";
    }

    if (m.includes("insufficient funds") || m.includes("insufficient balance for gas")) {
        return "Not enough SEI to pay gas.";
    }

    return msg;
}
