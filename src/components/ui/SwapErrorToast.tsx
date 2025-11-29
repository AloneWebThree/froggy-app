"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type SwapErrorToastProps = {
    open: boolean;
    onClose: () => void;
    errorMessage?: string;
};

export function SwapErrorToast({ open, onClose, errorMessage }: SwapErrorToastProps) {
    useEffect(() => {
        if (!open) return;
        const id = setTimeout(onClose, 6000); // errors linger slightly longer
        return () => clearTimeout(id);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
            <div
                className="relative rounded-2xl border border-[#FD6155]/80 bg-brand-card/95 px-4 py-3 backdrop-blur"
                style={{
                    boxShadow: "0 0 24px rgba(253, 97, 85, 0.45)", // Froggy blush glow
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
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#FD6155] bg-[#FD6155]/15 text-base">
                        <span className="leading-none"> ⚠️ </span>
                    </div>

                    <div className="space-y-1 text-xs">
                        <div className="font-semibold text-[#FD6155]">
                            Swap failed
                        </div>

                        <p className="text-brand-subtle">
                            The transaction did not complete. No funds were moved.
                        </p>

                        {errorMessage && (
                            <div className="pt-1 text-[11px] font-mono text-brand-subtle/90">
                                {errorMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
