"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen w-full px-6 py-16 flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl border border-white/10 bg-black/20 p-6">
                <h1 className="text-xl font-semibold">Something went wrong</h1>
                <p className="mt-2 text-sm text-white/70">
                    The app hit an unexpected error. Try again, or go back home.
                </p>

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition"
                    >
                        Try again
                    </button>

                    <Link
                        href="/"
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-brand-primary text-black hover:opacity-90 transition"
                    >
                        Home
                    </Link>
                </div>

                {error?.digest ? (
                    <p className="mt-4 text-[11px] text-white/50 font-mono">Digest: {error.digest}</p>
                ) : null}
            </div>
        </div>
    );
}