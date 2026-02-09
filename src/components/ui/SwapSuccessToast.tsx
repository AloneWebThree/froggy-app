"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type ToSymbol = "FROG" | "USDC";

type SwapSuccessToastProps = {
    open: boolean;
    onClose: () => void;
    txHash?: `0x${string}`;
    toSymbol: ToSymbol;
};

const EXPLORER_BASE = "https://seitrace.com/tx/"; // add ?chain=pacific-1 if you want

export function SwapSuccessToast({ open, onClose, txHash, toSymbol }: SwapSuccessToastProps) {
    // auto-hide after 5s
    useEffect(() => {
        if (!open) return;
        const id = setTimeout(onClose, 5000);
        return () => clearTimeout(id);
    }, [open, onClose]);

    if (!open) return null;

    const shortHash =
        txHash && `${txHash.slice(0, 6)}…${txHash.slice(txHash.length - 4)}`;

    const tokenLabel = toSymbol === "USDC" ? "USDC" : "$FROG";

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
            <div
                className="relative rounded-2xl border border-brand-primary/80 bg-brand-card/95 px-4 py-3 shadow-lg backdrop-blur"
                style={{
                    boxShadow: "0 0 12px rgba(110, 184, 25, 0.45)", // Froggy green glow
                }}
            >
                <button
                    onClick={onClose}
                    className="absolute right-2 top-2 rounded-full p-1 text-xs text-brand-subtle hover:bg-white/5"
                    aria-label="Close"
                >
                    <X className="h-3 w-3" />
                </button>

                <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-brand-primary bg-brand-primary/15 text-base">
                        <span className="leading-none"> 💰 </span>
                    </div>

                    <div className="space-y-1 text-xs">
                        <div className="font-semibold text-brand-text">Swap successful</div>

                        <p className="text-brand-subtle">
                            Your swap to{" "}
                            <span className="font-semibold text-brand-primary">
                                {tokenLabel}
                            </span>{" "}
                            was confirmed on Sei. Check your wallet for your updated balance.
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