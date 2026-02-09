// app/EnterGate.tsx
"use client";

import { useEffect, useState, useCallback } from "react";

const SESSION_KEY = "froggy_enter_gate_seen";

export default function EnterGate() {
    const [show, setShow] = useState(false);

    // On mount, decide whether to show based on sessionStorage
    useEffect(() => {
        if (typeof window === "undefined") return;

        const seen = window.sessionStorage.getItem(SESSION_KEY);
        if (!seen) {
            const id = requestAnimationFrame(() => setShow(true));
            return () => cancelAnimationFrame(id);
        }
    }, []);

    // Strong scroll lock while the gate is visible
    useEffect(() => {
        if (!show) return;

        const body = document.body;
        const html = document.documentElement;

        const prev = {
            position: body.style.position,
            top: body.style.top,
            width: body.style.width,
            overflow: body.style.overflow,
            overscrollBehavior: html.style.overscrollBehavior,
        };

        const scrollY = window.scrollY;

        body.style.position = "fixed";
        body.style.top = `-${scrollY}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";
        body.style.overflow = "hidden";
        html.style.overscrollBehavior = "none";

        return () => {
            body.style.position = prev.position;
            body.style.top = prev.top;
            body.style.width = prev.width;
            body.style.overflow = prev.overflow;
            html.style.overscrollBehavior = prev.overscrollBehavior;

            // Always start at top after dismissing splash (fixes mobile “halfway down”)
            window.scrollTo(0, 0);
        };
    }, [show]);

    const handleEnter = useCallback(() => {
        if (typeof window !== "undefined") {
            window.sessionStorage.setItem(SESSION_KEY, "1");
        }
        setShow(false);
    }, []);

    // Close on Esc
    useEffect(() => {
        if (!show) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleEnter();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [show, handleEnter]);

    if (!show) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Enter Froggy dApp"
            className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
        >
            {/* Opaque backdrop so the site isn't visible behind the splash */}
            <div className="absolute inset-0 bg-[color:var(--color-brand-bg)]/95" />

            {/* Card */}
            <div className="relative mx-4 w-full max-w-md rounded-[22px] p-[1.5px] animate-popin-overshoot">
                <div className="absolute -inset-1 rounded-[26px] bg-[conic-gradient(var(--tw-gradient-stops))] from-[#6eb819] via-[#5AA6FF] to-[#6eb819] blur-lg opacity-30 animate-glow" />
                <div
                    className="relative rounded-[20px] px-6 py-8 text-center shadow-xl"
                    style={{ background: "var(--color-brand-card)" }}
                >
                    <h1 className="text-3xl font-extrabold tracking-tight">Froggy dApp</h1>
                    <p className="mt-2 text-brand-subtle text-sm">
                        Zero-tax community token on Sei
                    </p>

                    <button
                        onClick={handleEnter}
                        className="group relative mx-auto mt-8 inline-flex w-full max-w-[240px] items-center justify-center rounded-xl px-6 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)] hover:scale-[1.02] active:scale-[0.99] transition-transform"
                        style={{ background: "var(--color-brand-primary)", color: "#081318" }}
                    >
                        <span className="relative z-10">Hop In</span>
                        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                            <span
                                className="absolute -left-1/3 top-0 h-full w-1/3 translate-x-0 skew-x-[-20deg] opacity-0 group-hover:opacity-30 group-hover:translate-x-[220%] transition-all duration-700"
                                style={{
                                    background:
                                        "linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)",
                                }}
                            />
                        </span>
                    </button>

                    <div className="pointer-events-none absolute -left-5 -top-5 h-3 w-3 rounded-full bg-[#6eb819] opacity-70 animate-float" />
                    <div className="pointer-events-none absolute -right-6 -bottom-6 h-4 w-4 rounded-full bg-[#5AA6FF] opacity-70 animate-float-delayed" />

                    <p className="mt-4 text-xs text-brand-subtle">
                        Leap BEYOND Limits!
                    </p>
                </div>
            </div>
        </div>
    );
}
