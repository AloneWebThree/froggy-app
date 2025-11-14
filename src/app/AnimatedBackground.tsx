// app/AnimatedBackground.tsx
"use client";

export default function AnimatedBackground() {
    return (
        <div
            aria-hidden="true"
            className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        >
            {/* Radial brand glow */}
            <div
                className="
                    absolute inset-0
                    bg-[radial-gradient(1200px_800px_at_50%_-10%,rgba(110,184,25,0.18),transparent_65%)]
                    animate-backdrop
                    motion-reduce:animate-none
                    will-change-transform will-change-opacity
                "
            />

            {/* Conic shimmer */}
            <div
                className="
                    absolute inset-0
                    bg-[conic-gradient(from_0deg,transparent,rgba(110,184,25,0.04),transparent)]
                    animate-spin-slow
                    motion-reduce:animate-none
                    will-change-transform will-change-opacity
                "
            />
        </div>
    );
}
