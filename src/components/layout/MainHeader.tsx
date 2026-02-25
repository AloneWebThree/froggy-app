"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Twitter, Send } from "lucide-react";

import { WalletButton } from "@/components/layout/WalletButton";

export function MainHeader() {
    const [menuOpen, setMenuOpen] = useState(false);
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

    // Mobile nav: focus, Esc key, click-outside
    useEffect(() => {
        if (!menuOpen) return;

        // focus first link when menu opens
        if (firstLinkRef.current) {
            firstLinkRef.current.focus();
        }

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setMenuOpen(false);
                toggleRef.current?.focus();
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            const nav = document.getElementById("mobile-nav");
            if (nav && (nav === e.target || nav.contains(e.target as Node))) return;

            const btn = toggleRef.current;
            if (btn && (btn === e.target || btn.contains(e.target as Node))) return;

            setMenuOpen(false);
            toggleRef.current?.focus();
        };

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown, true);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown, true);
        };
    }, [menuOpen]);

    return (
        <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5">
            <div className="mx-auto max-w-6xl px-4">
                <div className="flex h-16 items-center justify-between">
                    <a
                        className="flex items-center gap-3"
                        href="#home"
                        aria-label="Froggy home"
                    >
                        <Image
                            src="/froggy-logo.png"
                            alt="Froggy logo"
                            width={36}
                            height={36}
                            className="rounded-xl object-contain"
                            priority
                        />
                        <span className="font-semibold tracking-wide text-brand-text">
                            FROGGY
                        </span>
                    </a>

                    {/* Desktop nav */}
                    <nav className="hidden gap-8 md:flex text-sm text-slate-200/90">
                        <a href="#token" className="hover:text-white">
                            Token
                        </a>
                        <a href="#swap" className="hover:text-white">
                            Swap
                        </a>
                        <a href="#liquidity" className="hover:text-white">
                            Liquidity
                        </a>
                        <a href="#gallery" className="hover:text-white">
                            Gallery
                        </a>
                        <a href="#roadmap" className="hover:text-white">
                            Roadmap
                        </a>
                        <a href="#faq" className="hover:text-white">
                            FAQ
                        </a>
                    </nav>

                    {/* Desktop socials */}
                    <div className="hidden md:flex items-center gap-3">
                        <a
                            href="https://x.com/frogonsei"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Froggy on X"
                        >
                            <Twitter
                                size={20}
                                className="opacity-80 hover:opacity-100 text-brand-text"
                            />
                        </a>

                        <a
                            href="https://t.me/frogonsei"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Froggy on Telegram"
                        >
                            <Send
                                size={20}
                                className="opacity-80 hover:opacity-100 text-brand-text"
                            />
                        </a>
                    </div>

                    {/* Wallet + mobile menu toggle */}
                    <div className="flex items-center gap-3">
                        <div className="hidden md:block">
                            <WalletButton />
                        </div>
                        <button
                            type="button"
                            ref={toggleRef}
                            className="md:hidden rounded-lg p-2 hover:bg-white/5"
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-label="Toggle navigation"
                            aria-controls="mobile-nav"
                            aria-expanded={menuOpen}
                        >
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <path
                                    d="M4 6h16M4 12h16M4 18h16"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile overlay + nav */}
            {menuOpen && (
                <>
                    <button
                        type="button"
                        aria-hidden="true"
                        className="fixed inset-0 bg-black/30 md:hidden z-40"
                        onClick={() => {
                            setMenuOpen(false);
                            toggleRef.current?.focus();
                        }}
                    />

                    <nav
                        id="mobile-nav"
                        aria-label="Primary"
                        className="md:hidden border-t border-white/10 relative z-50"
                    >
                        <ul
                            role="menu"
                            className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 text-sm"
                        >
                            {[
                                { id: "token", label: "Token" },
                                { id: "swap", label: "Swap" },
                                { id: "liquidity", label: "Liquidity" },
                                { id: "gallery", label: "Gallery" },
                                { id: "roadmap", label: "Roadmap" },
                                { id: "faq", label: "FAQ" },
                            ].map((item, i) => (
                                <li role="none" key={item.id}>
                                    <a
                                        role="menuitem"
                                        ref={i === 0 ? firstLinkRef : undefined}
                                        href={`#${item.id}`}
                                        className="block py-1 hover:text-white"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            toggleRef.current?.focus();
                                        }}
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            ))}

                            {/* Wallet button on mobile */}
                            <li role="none" className="mt-3">
                                <WalletButton />
                            </li>

                            {/* Social icons */}
                            <li
                                role="none"
                                className="mt-4 flex items-center gap-4"
                            >
                                <a
                                    href="https://x.com/frogonsei"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Froggy on X"
                                >
                                    <Twitter
                                        size={22}
                                        className="opacity-80 hover:opacity-100 text-brand-text"
                                    />
                                </a>

                                <a
                                    href="https://t.me/frogonsei"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Froggy on Telegram"
                                >
                                    <Send
                                        size={22}
                                        className="opacity-80 hover:opacity-100 text-brand-text"
                                    />
                                </a>
                            </li>
                        </ul>
                    </nav>
                </>
            )}
        </header>
    );
}
