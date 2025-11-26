"use client";

import { useState } from "react";

type CopyButtonProps = {
    value: string;
    label: string;
};

export function CopyButton({ value, label }: CopyButtonProps) {
    const [msg, setMsg] = useState("");

    const copy = async () => {
        try {
            if (!("clipboard" in navigator)) throw new Error("no-clipboard");
            await navigator.clipboard.writeText(value);
            setMsg("Copied");
        } catch {
            setMsg("Copy failed");
        } finally {
            setTimeout(() => setMsg(""), 1400);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={copy}
                aria-label={`Copy ${label}`}
                className="rounded-lg px-2 py-1 text-xs border border-white/20 bg-white/5 text-brand-subtle/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
                Copy
            </button>
            <span
                role="status"
                aria-live="polite"
                className="text-[11px] text-brand-subtle min-w-[3.5rem]"
            >
                {msg}
            </span>
        </div>
    );
}
