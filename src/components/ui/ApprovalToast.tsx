// src/components/ui/ApprovalToast.tsx
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export type ApprovalTokenSymbol = "USDY" | "DRG" | "FROG" | "USDC";

type ApprovalToastProps = {
    open: boolean;
    onClose: () => void;
    txHash?: `0x${string}`;
    tokenSymbol: ApprovalTokenSymbol;
};

const EXPLORER_BASE = "https://seitrace.com/tx/";

export function ApprovalToast({
    open,
    onClose,
    txHash,
    tokenSymbol,
}: ApprovalToastProps) {
    // auto-hide after 5s
    useEffect(() => {
        if (!open) return;
        const id = setTimeout(onClose, 5000);
        return () => clearTimeout(id);
    }, [open, onClose]);

    if (!open) return null;

    const shortHash =
        txHash && `${txHash.slice(0, 6)}…${txHash.slice(txHash.length - 4)}`;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
            <div
                className="relative rounded-2xl border border-white/10 bg-brand-card/95 px-4 py-3 shadow-lg backdrop-blur"
                style={{ boxShadow: "0 0 10px rgba(255, 255, 255, 0.12)" }}
            >
                <button
                    onClick={onClose}
                    className="absolute right-2 top-2 rounded-full p-1 text-xs text-brand-subtle hover:bg-white/5"
                    aria-label="Close"
                >
                    <X className="h-3 w-3" />
                </button>

                <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-base">
                        <span className="leading-none">✅</span>
                    </div>

                    <div className="space-y-1 text-xs">
                        <div className="font-semibold text-brand-text">Approval confirmed</div>

                        <p className="text-brand-subtle">
                            You approved the router to spend your{" "}
                            <span className="font-semibold text-brand-primary">{tokenSymbol}</span>.
                            You can now submit the swap.
                        </p>

                        {txHash && (
                            <div className="pt-1 text-[11px]">
                                <div className="text-brand-subtle">
                                    Tx:{" "}
                                    <a
                                        href={`${EXPLORER_BASE}${txHash}?chain=pacific-1`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-mono text-brand-primary hover:underline"
                                    >
                                        {shortHash}
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
