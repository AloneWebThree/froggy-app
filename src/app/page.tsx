"use client";

import { useState, useRef, useEffect } from "react";
import { WalletButton } from "./providers";
import LiveStats from "@/components/LiveStats";
import Image from "next/image";
import Head from "next/head";
import { Twitter, Send } from "lucide-react"; // Send = Telegram icon

import froggyBase from "@public/gallery/froggy-base.png";
import froggyBeer from "@public/gallery/froggy-beer.png";
import froggyCalm from "@public/gallery/froggy-calm.png";
import froggyCape from "@public/gallery/froggy-cape.png";
import froggyChampagne from "@public/gallery/froggy-champagne.png";
import froggyCoffee from "@public/gallery/froggy-coffee.png";
import froggyCook from "@public/gallery/froggy-cook.png";
import froggyCowboy from "@public/gallery/froggy-cowboy.png";
import froggyDiamond from "@public/gallery/froggy-diamond.png";
import froggyFarmer from "@public/gallery/froggy-farmer.png";
import froggyFight from "@public/gallery/froggy-fight.png";
import froggyFortune from "@public/gallery/froggy-fortune.png";
import froggyGuitar from "@public/gallery/froggy-guitar.png";
import froggyHero from "@public/gallery/froggy-hero.png";
import froggyJetpack from "@public/gallery/froggy-jetpack.png";
import froggyKarate from "@public/gallery/froggy-karate.png";
import froggyKiss from "@public/gallery/froggy-kiss.png";
import froggyLaptop from "@public/gallery/froggy-laptop.png";
import froggyMap from "@public/gallery/froggy-map.png";
import froggyMartini from "@public/gallery/froggy-martini.png";
import froggyMoto from "@public/gallery/froggy-moto.png";
import froggyPopcorn from "@public/gallery/froggy-popcorn.png";
import froggySamurai from "@public/gallery/froggy-samurai.png";
import froggySurf from "@public/gallery/froggy-surf.png";
import froggyVik from "@public/gallery/froggy-vik.png";
import froggyYaka from "@public/gallery/froggy-yaka.png";


const ADDR = {
  token: "0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9",
  pair: "0x373e718e54e73fb462fec3a73e9645efea280b84",
};

const URL = {
  geckoEmbed: `https://www.geckoterminal.com/sei-evm/pools/${ADDR.pair}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=1d`,
    geckoFull: `https://www.geckoterminal.com/sei-evm/pools/${ADDR.pair}`,
        pairExplorer: `https://seitrace.com/address/${ADDR.pair}?chain=pacific-1`,
            tokenExplorer: `https://seitrace.com/token/${ADDR.token}?chain=pacific-1`,
                dragon: `https://dragonswap.app/swap?outputCurrency=${ADDR.token}&inputCurrency=`,
                    yaka: `https://yaka.finance/swap?inputCurrency=SEI&outputCurrency=${ADDR.token}`,
};

function CopyButton({ value, label }: { value: string; label: string }) {
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
                className="rounded-lg px-2 py-1 text-xs border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
                Copy
            </button>
            <span role="status" aria-live="polite" className="text-[11px] text-brand-subtle">
                {msg}
            </span>
        </div>
    );
}

//Pie chart or Donut
type Slice = { label: string; value: number; color: string };

function Donut({
    data,
    size = 160,
    thickness = 18,
    centerLabel,
}: {
    data: Slice[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
}) {
    const total = data.reduce((a, b) => a + b.value, 0) || 1;

    // build conic-gradient stops without mutating
    const stops = data
        .reduce<{ segs: string[]; acc: number }>((st, s) => {
            const start = (st.acc / total) * 100;
            const end = ((st.acc + s.value) / total) * 100;
            st.segs.push(`${s.color} ${start}% ${end}%`);
            return { segs: st.segs, acc: st.acc + s.value };
        }, { segs: [], acc: 0 })
        .segs.join(", ");

    const mask = `radial-gradient(closest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px))`;

    return (
        // wrapper: stack on mobile, row on md+
        <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-center md:justify-center md:gap-10">
            {/* Donut ring */}
            <div
                className="relative shrink-0 rounded-full"
                role="img"
                aria-label={centerLabel ? `${centerLabel} distribution` : "distribution"}
                style={{
                    // responsive dimension: clamp to viewport on mobile
                    width: `clamp(140px, 45vw, ${size}px)`,
                    height: `clamp(140px, 45vw, ${size}px)`,
                }}
            >
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background: `conic-gradient(${stops})`,
                        WebkitMask: mask,
                        mask,
                        transform: "rotate(-90deg)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
                    }}
                />
                {centerLabel && (
                    <div className="absolute inset-0 grid place-items-center text-sm font-semibold pointer-events-none">
                        {centerLabel}
                    </div>
                )}
            </div>

            {/* Legend: 1 col on mobile, 2 cols on md+; no wide min-width on mobile */}
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm w-full sm:w-auto md:min-w-[26rem]">
                {data.map((s) => (
                    <li key={s.label} className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                        <span className="text-slate-300/90">{s.label}</span>
                        <span className="ml-auto font-semibold">
                            {Math.round((s.value / total) * 100)}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function FroggyLanding() {
    const [menuOpen, setMenuOpen] = useState(false);
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

    // token select state
    type FromChoice =
        | { kind: "native"; label: "SEI"; value: "SEI" }
        | { kind: "erc20"; label: "Native USDC"; value: string }
        | { kind: "erc20"; label: "Native USDT"; value: string }
        | { kind: "erc20"; label: "WBTC"; value: string }
        | { kind: "erc20"; label: "WETH"; value: string }
        | { kind: "custom"; label: "Custom"; value: string };

    const FROM_PRESETS: FromChoice[] = [
        { kind: "native", label: "SEI", value: "SEI" },
        // If you know these, fill real addresses. Otherwise leave commented
        { kind: "erc20", label: "Native USDC", value: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392" },
        { kind: "erc20", label: "Native USDT", value: "0x9151434b16b9763660705744891fA906F660EcC5" },
        { kind: "erc20", label: "WBTC", value: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c" },
        { kind: "erc20", label: "WETH", value: "0x160345fC359604fC6e70E3c5fAcbdE5F7A9342d8" },
        { kind: "custom", label: "Custom", value: "" },
    ];

    const [fromChoice, setFromChoice] = useState<FromChoice>(FROM_PRESETS[0]);
    const [customFrom, setCustomFrom] = useState("");

    // derive the actual inputCurrency param for each DEX
    const inputParam = (() => {
        if (fromChoice.kind === "custom") return customFrom || "";
        return fromChoice.value;
    })();

    // simple 0x address check (not exhaustive)
    const isAddr = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

    // build DEX hrefs using current selection
    const yakaHref = `https://yaka.finance/swap?inputCurrency=${encodeURIComponent(
        inputParam || "SEI"
    )}&outputCurrency=${ADDR.token}`;

    const dragonHref = `https://dragonswap.app/swap?outputCurrency=${ADDR.token
        }&inputCurrency=${encodeURIComponent(inputParam)}`;

    const galleryItems = [
        { src: froggyBase, alt: "Froggy base" },
        { src: froggyBeer, alt: "Froggy beer" },
        { src: froggyCalm, alt: "Froggy calm" },
        { src: froggyCape, alt: "Froggy cape" },
        { src: froggyChampagne, alt: "Froggy champagne" },
        { src: froggyCoffee, alt: "Froggy coffee" },
        { src: froggyCook, alt: "Froggy cook" },
        { src: froggyCowboy, alt: "Froggy cowboy" },
        { src: froggyDiamond, alt: "Froggy diamond" },
        { src: froggyFarmer, alt: "Froggy farmer" },
        { src: froggyFight, alt: "Froggy fight" },
        { src: froggyFortune, alt: "Froggy fortune" },
        { src: froggyGuitar, alt: "Froggy guitar" },
        { src: froggyHero, alt: "Froggy hero" },
        { src: froggyJetpack, alt: "Froggy jetpack" },
        { src: froggyKarate, alt: "Froggy karate" },
        { src: froggyKiss, alt: "Froggy kiss" },
        { src: froggyLaptop, alt: "Froggy laptop" },
        { src: froggyMap, alt: "Froggy map" },
        { src: froggyMartini, alt: "Froggy martini" },
        { src: froggyMoto, alt: "Froggy moto" },
        { src: froggyPopcorn, alt: "Froggy popcorn" },
        { src: froggySamurai, alt: "Froggy samurai" },
        { src: froggySurf, alt: "Froggy surf" },
        { src: froggyVik, alt: "Froggy vik" },
        { src: froggyYaka, alt: "Froggy yaka" },
    ] as const;

    //Visible pages
    const PAGE = 3;
    const [visibleCount, setVisibleCount] = useState(PAGE);
    const visibleItems = galleryItems.slice(0, visibleCount);

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(0);

    const openerRef = useRef<HTMLButtonElement | null>(null);
    const lightboxRootRef = useRef<HTMLDivElement | null>(null);

    const startX = useRef<number | null>(null);

    //Gallery ref
    const galleryRef = useRef<HTMLElement | null>(null);

    //Swipe handles
    const onTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (startX.current == null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx > 40) setActiveIndex(i => (i - 1 + galleryItems.length) % galleryItems.length);
        if (dx < -40) setActiveIndex(i => (i + 1) % galleryItems.length);
        startX.current = null;
    };

    //Chart
    const supplyDistribution: Slice[] = [
        { label: "Liquidity Pool", value: 20, color: "#6eb819" }, // primary
        { label: "Community", value: 70, color: "#5AA6FF" }, // secondary (big slice)
        { label: "Development Team", value: 5, color: "#93A8C3" },
        { label: "CEX Reserve", value: 5, color: "#E9F1FF" },  // was #E9F1FF
    ];

    // Lightbox keyboard controls
    useEffect(() => {
        if (!lightboxOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setLightboxOpen(false);
            if (e.key === "ArrowRight") setActiveIndex((i) => (i + 1) % galleryItems.length);
            if (e.key === "ArrowLeft") setActiveIndex((i) => (i - 1 + galleryItems.length) % galleryItems.length);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [lightboxOpen, galleryItems.length]);

    // Gallery scroll lock
    useEffect(() => {
        document.body.style.overflow = lightboxOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [lightboxOpen]);

    // Gallery focus
    useEffect(() => {
        if (!lightboxOpen || !lightboxRootRef.current) return;
        const root = lightboxRootRef.current;
        const selector = 'a, button, [tabindex]:not([tabindex="-1"])';
        const getFocusables = () =>
            Array.from(root.querySelectorAll<HTMLElement>(selector))
                .filter(el => !el.hasAttribute("disabled"));
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const els = getFocusables();
            if (els.length === 0) return;
            const first = els[0];
            const last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [lightboxOpen]);

    // Nav menu
    useEffect(() => {
        if (menuOpen && firstLinkRef.current) firstLinkRef.current.focus();
    }, [menuOpen]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setMenuOpen(false);
                toggleRef.current?.focus();
            }
        };
        if (menuOpen) document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen) return;

        const onPointerDown = (e: PointerEvent) => {
            const nav = document.getElementById("mobile-nav");
            if (nav && (nav === e.target || nav.contains(e.target as Node))) return;
            const btn = toggleRef.current;
            if (btn && (btn === e.target || btn.contains(e.target as Node))) return;
            setMenuOpen(false);
            toggleRef.current?.focus();
        };

        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [menuOpen]);

    const brand = {
        bg: "#0b1221",
        primary: "#6eb819",
        secondary: "#5AA6FF",
        text: "#E9F1FF",
        card: "#121a2e",
        subtle: "#93A8C3",
    } as const;


    //Main page section
    return (
        <div className="min-h-screen w-full" style={{ background: brand.bg, color: brand.text }}>
                <Head>
                    <title>Froggy | Zero-tax utility on Sei Network</title>
                    <link rel="icon" href="/favicon.ico" />
                    <meta name="theme-color" content="#6eb819" />
                    <meta
                        name="description"
                        content="1B supply, zero tax, locked liquidity, and community-driven utility on Sei Network."
                    />
                    <meta property="og:title" content="Froggy | Zero-tax meme utility" />
                    <meta
                        property="og:description"
                        content="Trade $FROG and join the army on Sei EVM."
                    />
                    <meta property="og:image" content="/og-froggy.png" />
                    <meta name="theme-color" content="#6eb819" />
                </Head>
            <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5">
                <div className="mx-auto max-w-6xl px-4">
                    <div className="flex h-16 items-center justify-between">
                        <a className="flex items-center gap-3" href="#home" aria-label="Froggy home">
                            <Image src="/froggy-logo.png" alt="Froggy logo" width={36} height={36} className="rounded-xl object-contain" priority />
                            <span className="font-semibold tracking-wide text-brand-text">FROGGY</span>
                        </a>
                        <nav className="hidden gap-8 md:flex text-sm text-slate-200/90">
                            <a href="#token" className="hover:text-white">Token</a>
                            <a href="#swap" className="hover:text-white">Swap</a>
                            <a href="#gallery" className="hover:text-white">Gallery</a>
                            <a href="#roadmap" className="hover:text-white">Roadmap</a>
                            <a href="#faq" className="hover:text-white">FAQ</a>
                        </nav>
                        {/* Social icons */}
                        <div className="hidden md:flex items-center gap-3">
                            <a
                                href="https://x.com/frogonsei"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Froggy on X"
                            >
                                <Twitter size={20} className="opacity-80 hover:opacity-100 text-brand-text" />
                            </a>

                            <a
                                href="https://t.me/frogonsei"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Froggy on Telegram"
                            >
                                <Send size={20} className="opacity-80 hover:opacity-100 text-brand-text" />
                            </a>
                        </div>
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
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
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
                        <nav id="mobile-nav" aria-label="Primary" className="md:hidden border-t border-white/10 relative z-50">
                            <ul role="menu" className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 text-sm">
                                {[
                                    { id: "token", label: "Token" },
                                    { id: "swap", label: "Swap" },
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
                                <div className="mt-4 flex items-center gap-4 px-4">
                                    <a
                                        href="https://x.com/frogonsei"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Froggy on X"
                                    >
                                        <Twitter size={22} className="opacity-80 hover:opacity-100 text-brand-text" />
                                    </a>

                                    <a
                                        href="https://t.me/frogonsei"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Froggy on Telegram"
                                    >
                                        <Send size={22} className="opacity-80 hover:opacity-100 text-brand-text" />
                                    </a>
                                </div>
                            </ul>
                        </nav>
                    </>
                )}
            </header>

            {/* Hero */}
            <section id="home" className="relative">
                <div
                    className="absolute inset-0 -z-10 opacity-30"
                    style={{
                        background: `radial-gradient(60% 60% at 50% 20%, ${brand.secondary}22 0%, transparent 60%), radial-gradient(40% 40% at 80% 10%, ${brand.primary}22 0%, transparent 60%)`,
                    }}
                />
                <div className="mx-auto max-w-6xl px-4 py-8 md:py-16 grid md:grid-cols-2 gap-10 items-center">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
                            Community first,
                            <span style={{ color: brand.primary }}> zero-tax</span> trading on Sei Network
                        </h1>
                        <p className="mt-4 text-slate-300/90 max-w-prose">
                            1B supply. Liquidity locked. Built for memes, investors, and holders. Utility that compounds with every holder.
                        </p>
                        <p className="mt-4 text-slate-300/90 max-w-prose">Contract is immutable and finalized!</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <a
                                href="#swap"
                                className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                                style={{ background: brand.primary, color: "#081318" }}
                            >
                                Trade $FROG
                            </a>
                            <a href="#token"
                                className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10">
                                Token details
                            </a>
                        </div>
                        <div className="mt-6 text-xs text-brand-subtle leading-snug">
                            CA: <code className="select-all">{ADDR.token}</code>
                        </div>
                    </div>

                    {/* Mascot card placeholder */}
                    <div className="relative">
                        <div className="relative mx-auto aspect-square max-w-sm rounded-3xl shadow-xl" style={{ background: brand.card }}>
                            <Image src="/froggy-base.png" alt="Froggy base mascot" fill sizes="(min-width: 768px) 24rem, 18rem" className="object-contain p-4" />
                        </div>
                        <div className="absolute -top-3 -right-3 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: brand.secondary, boxShadow: `0 0 10px ${brand.secondary}` }}>
                            Live
                        </div>
                    </div>
                </div>
            </section>

            {/* Token Section */}
            <section id="token" className="mx-auto max-w-6xl px-4 pt-6 pb-14">
                <h2 className="text-2xl md:text-3xl font-bold">Token</h2>
                <p className="mt-2 text-slate-300/90 text-sm leading-snug text-center md:text-left">
                    Core tokenomics for the Froggy ecosystem.
                </p>

                {/* Token metric cards */}
                <div className="mt-8 grid gap-6 md:grid-cols-3">
                    {[
                        { k: "Ticker", v: "$FROG", d: "The heartbeat of the Froggy ecosystem." },
                        {
                            k: "Network",
                            v: "Sei Network (EVM • Chain ID 1329)",
                            d: "Fast, secure, and gas-efficient.",
                        },
                        {
                            k: "Total Supply",
                            v: "1,000,000,000",
                            d: "Fixed supply. No mints. No burns.",
                        },
                        { k: "Tax", v: "0%", d: "Zero on buys and sells." },
                        {
                            k: "Liquidity",
                            v: "Locked",
                            d: "Verified on-chain and permanent.",
                        },
                        {
                            k: "Holders",
                            v: "1,279 Holders",
                            d: "View holder data on Sei Explorer.",
                            link: "https://seitrace.com/token/0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9?chain=pacific-1&tab=holders",
                        },
                    ].map(({ k, v, d, link }) => (
                        <div
                            key={k}
                            className="rounded-2xl p-5 border border-white/10 bg-brand-card/60 transition-all duration-200 hover:border-brand-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.6)]"
                        >
                            <div className="text-brand-subtle text-xs uppercase tracking-wide">
                                {k}
                            </div>
                            {link ? (
                                <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 block text-lg font-semibold text-brand-primary break-all"
                                >
                                    {v}
                                </a>
                            ) : (
                                <div className="mt-1 text-lg font-semibold text-slate-100">{v}</div>
                            )}
                            <div className="mt-1 text-slate-400 text-sm">{d}</div>
                        </div>
                    ))}
                </div>

                {/* Distribution */}
                <div className="mt-8 rounded-2xl border border-white/10 bg-brand-card/60 p-5 relative overflow-hidden">
                    {/* Watermark */}
                    <Image
                        src="/gallery/froggy-hero.png"
                        alt=""
                        aria-hidden="true"
                        width={400}
                        height={400}
                        priority
                        className="pointer-events-none select-none absolute -right-16 -bottom-20 opacity-5 md:opacity-10"
                    />

                    <div className="relative">
                        <h3 className="text-lg font-semibold flex items-center justify-between text-center md:text-left">
                            <span>Supply Distribution</span>
                            <span className="text-xs text-brand-subtle">
                                Percentages set at bonding on 10/11/2024
                            </span>
                        </h3>

                        <div className="mt-4">
                            <Donut data={supplyDistribution} centerLabel="Tokenomics" size={220} thickness={22} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Swap placeholder */}
            <section id="swap" className="mx-auto max-w-6xl px-4 pb-14">
                <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
                <p className="mt-2 text-slate-300/90 text-sm leading-snug">Trade $FROG with live price data.</p>

                <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr] items-start">
                    {/* Left: chart */}
                    <div className="rounded-2xl overflow-hidden border border-white/10 bg-brand-card h-[min(70vh,680px)] min-h-[520px] flex flex-col">
                        <iframe
                            title="FROG/SEI price chart on GeckoTerminal"
                            src={URL.geckoEmbed}
                            className="w-full flex-1"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            sandbox="allow-same-origin allow-scripts allow-popups"
                        />

                        <div className="border-t border-white/10 bg-black/20 backdrop-blur px-3 py-2 flex items-center gap-2">
                            <div className="text-xs text-brand-subtle">Pair</div>
                            <code className="text-[11px] font-mono select-all truncate max-w-[40ch]" title={ADDR.pair}>
                                {ADDR.pair}
                            </code>
                            <div className="ml-auto flex items-center gap-2">
                                <CopyButton value={ADDR.pair} label="pair address" />
                                <a href={URL.pairExplorer} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5">
                                    Explorer ↗
                                </a>
                                <a href={URL.geckoFull} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5">
                                    Full chart ↗
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Right: quick action + stats */}
                    <div className="rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col h-auto md:h-[min(70vh,680px)]">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-brand-subtle">Quick Action</div>
                                <h3 className="mt-1 text-lg font-semibold">$FROG Swap</h3>
                            </div>
                            <Image src="/froggy-cape.png" alt="Froggy icon" width={48} height={48} className="rounded-full" decoding="async" />
                        </div>

                        {/* Inputs (real selector) */}
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="text-xs text-brand-subtle" htmlFor="from-asset">
                                    From
                                </label>
                                <div className="mt-1 grid gap-2">
                                    <select
                                        id="from-asset"
                                        className="h-12 w-full rounded-xl bg-white/5 text-left px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 text-brand-text"
                                        style={{
                                            color: "#E9F1FF",        // visible text color
                                            backgroundColor: "#121a2e", // matches brand.card
                                        }}
                                        value={fromChoice.label}
                                        onChange={(e) => {
                                            const pick = FROM_PRESETS.find(p => p.label === e.target.value)!;
                                            setFromChoice(pick);
                                        }}
                                    >
                                        {FROM_PRESETS.map(p => (
                                            <option key={p.label} value={p.label}>{p.label}</option>
                                        ))}
                                    </select>

                                    {fromChoice.kind === "custom" && (
                                        <div className="grid gap-1">
                                            <input
                                                inputMode="text"
                                                placeholder="Paste ERC-20 address, e.g. 0xabc…"
                                                className="h-11 w-full rounded-xl bg-white/5 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                                value={customFrom}
                                                onChange={(e) => setCustomFrom(e.target.value.trim())}
                                            />
                                            <div className="text-[11px] text-brand-subtle">
                                                {customFrom
                                                    ? isAddr(customFrom)
                                                        ? "Valid address"
                                                        : "Enter a 0x + 40 hex address"
                                                    : "Optional unless using a custom token"}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-brand-subtle" htmlFor="to-asset">
                                    To ($FROG)
                                </label>
                                <button
                                    id="to-asset"
                                    type="button"
                                    className="mt-1 h-12 w-full rounded-xl bg-white/5 text-left px-3 text-sm font-mono"
                                    title={ADDR.token}
                                >
                                    0x…{ADDR.token.slice(-6)}
                                </button>
                            </div>
                        </div>

                        <a
                            href={dragonHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 h-11 w-full rounded-2xl bg-brand-secondary font-semibold text-sm text-[#081318] grid place-items-center transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                        >
                            Open on DragonSwap ↗
                        </a>

                        <a
                            href={yakaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 h-11 w-full rounded-2xl bg-brand-primary font-semibold text-sm text-[#081318] grid place-items-center transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                        >
                            Open on Yaka ↗
                        </a>

                        <div className="mt-4 border-t border-white/10 pt-4" />

                        {/* Contract + copy */}
                        <div className="mt-5 rounded-xl border border-white/10 p-3">
                            <div className="text-xs text-brand-subtle">Contract</div>
                            <div className="mt-1 flex items-center gap-2">
                                <code className="text-[10px] select-all break-all">{ADDR.token}</code>
                                <div className="ml-auto">
                                    <CopyButton value={ADDR.token} label="contract address" />
                                </div>
                            </div>
                        </div>

                        <LiveStats />

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <a href={URL.tokenExplorer} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5">
                                View token on Seitrace
                            </a>
                            <a href={URL.geckoFull} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5">
                                View full chart
                            </a>
                        </div>

                        <div className="mt-12 text-[11px] text-brand-subtle/90 leading-snug">Uses external DEX for execution. Slippage and fees apply.</div>
                    </div>
                </div>
            </section>

            {/* Gallery */}
            <section ref={galleryRef} id="gallery" className="mx-auto max-w-6xl px-4 pb-14">
                <h2 id="gallery-heading" className="text-2xl md:text-3xl font-bold">Gallery</h2>
                <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                    On-brand poses of Froggy. Click to view full size.
                </p>

                {/* Grid */}
                <ul id="gallery-grid" className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {visibleItems.map((item, i) => (
                        <li key={item.alt}>
                            <button
                                ref={i === activeIndex ? openerRef : undefined}
                                type="button"
                                onClick={() => { setActiveIndex(i); setLightboxOpen(true); }}
                                className="group block w-full rounded-2xl overflow-hidden border border-white/10 bg-brand-card hover:border-brand-primary/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                                aria-label={`Open image: ${item.alt}`}
                            >
                                <div className="relative aspect-square">
                                    <Image
                                        src={item.src}
                                        alt={item.alt}
                                        fill
                                        sizes="(min-width: 768px) 33vw, 50vw"
                                        className="object-contain p-3 transition-transform duration-200 group-hover:scale-[1.02]"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
                {/* Show more / Collapse controls */}
                {(visibleCount < galleryItems.length || visibleCount > PAGE) && (
                    <div className="mt-4 flex items-center gap-3">
                        {/* Show more button */}
                        {visibleCount < galleryItems.length && (
                            <button
                                type="button"
                                aria-controls="gallery-grid"
                                onClick={() =>
                                    setVisibleCount(c => Math.min(c + PAGE, galleryItems.length))
                                }
                                className="rounded-lg px-4 py-2 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                            >
                                Show {Math.min(PAGE, galleryItems.length - visibleCount)} more
                            </button>
                        )}

                        {/* Collapse button */}
                        {visibleCount > PAGE && (
                            <button
                                type="button"
                                onClick={() => {
                                    setVisibleCount(PAGE);
                                    setActiveIndex(i => Math.min(i, PAGE - 1)); // ensure opener exists
                                    queueMicrotask(() =>
                                        galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                                    );
                                }}
                                className="rounded-lg px-4 py-2 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                            >
                                Collapse
                            </button>
                        )}
                    </div>
                )}

                {/* Lightbox */}
                {lightboxOpen && (
                    <>
                        {/* Backdrop */}
                        <button
                            type="button"
                            aria-label="Close gallery"
                            className="fixed inset-0 z-50 bg-black/80"
                            onClick={() => {
                                setLightboxOpen(false);
                                openerRef.current?.focus();
                            }}
                        />
                        {/* Dialog */}
                        <div
                            ref={lightboxRootRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="gallery-heading"
                            data-lightbox
                            className="fixed inset-0 z-50 grid place-items-center p-4"
                        >
                            <div className="relative w-full max-w-3xl">
                                <div
                                    onTouchStart={onTouchStart}
                                    onTouchEnd={onTouchEnd}
                                    className="relative aspect-square rounded-2xl bg-brand-card border border-white/10 overflow-hidden"
                                >
                                    <Image
                                        src={galleryItems[activeIndex].src}
                                        alt={galleryItems[activeIndex].alt}
                                        fill
                                        sizes="(min-width: 1024px) 768px, 90vw"
                                        className="object-contain p-4"
                                        priority
                                    />
                                    <div aria-live="polite" className="sr-only">
                                        Viewing {galleryItems[activeIndex].alt} ({activeIndex + 1} of {galleryItems.length})
                                    </div>
                                </div>

                                {/* Controls */}
                                <nav
                                    aria-label="Gallery navigation"
                                    className="mt-3 flex items-center justify-between text-sm text-slate-300/90"
                                >
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="rounded-lg px-3 py-1 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                            onClick={() => setActiveIndex(i => (i - 1 + galleryItems.length) % galleryItems.length)}
                                            aria-label="Previous image"
                                        >
                                            ← Prev
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-lg px-3 py-1 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                            onClick={() => setActiveIndex(i => (i + 1) % galleryItems.length)}
                                            aria-label="Next image"
                                        >
                                            Next →
                                        </button>
                                    </div>

                                    <div aria-live="polite">
                                        {activeIndex + 1} / {galleryItems.length}
                                    </div>

                                    <button
                                        type="button"
                                        className="rounded-lg px-3 py-1 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                        onClick={() => {
                                            setLightboxOpen(false);
                                            openerRef.current?.focus();
                                        }}
                                        aria-label="Close"
                                    >
                                        Close ⨯
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* Roadmap */}
            <section id="roadmap" className="mx-auto max-w-6xl px-4 pb-14">
                <h2 className="text-2xl md:text-3xl font-bold">Roadmap</h2>
                <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                    A transparent look at Froggy development path.
                </p>

                <ol className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                        {
                            t: "Phase 1",
                            d: "dApp launch, website integration, and live price with swap options functionality.",
                            done: true,
                        },
                        {
                            t: "Phase 2",
                            d: "Dashboard for on-chain streaks, early supporter badges, and campaign prizes.",
                            done: false,
                        },
                        {
                            t: "Phase 3",
                            d: "Expanded ecosystem tools, partnerships, and DeFi platform expansion.",
                            done: false,
                        },
                    ].map(({ t, d, done }, i) => (
                        <li
                            key={t}
                            className="rounded-2xl p-5 border border-white/10 hover:border-brand-primary/40 transition-all duration-200"
                            style={{
                                background: "var(--color-brand-card)",
                                opacity: done ? 0.9 : 1,
                            }}
                        >
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full font-semibold"
                                    style={{
                                        background: "var(--color-brand-primary)",
                                        color: "#081318",
                                    }}
                                >
                                    {i + 1}
                                </span>
                                {t}
                            </div>
                            <div className="mt-2 font-semibold text-slate-100">{d}</div>
                            {done && (
                                <div className="mt-3 text-xs text-brand-primary font-medium">
                                    ✓ Completed
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            </section>

            {/* FAQ */}
            <section id="faq" className="mx-auto max-w-6xl px-4 pb-20">
                <h2 className="text-2xl md:text-3xl font-bold">FAQ</h2>
                <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                    Common questions about $FROG and its ecosystem.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {[
                        {
                            q: "Is there a trading tax?",
                            a: "No. Zero on buys and sells. Trade to FULL potential!",
                        },
                        {
                            q: "Where is liquidity?",
                            a: "Locked permanently and verified on-chain. More can be added anytime by Dev team or community members.",
                        },
                        {
                            q: "What is utility?",
                            a: "Community-first DeFi, liquidity provision token, and on-chain streaks.",
                        },
                        {
                            q: "What chain is Froggy on?",
                            a: "Sei Network (EVM). Secure, scalable, and low fees.",
                        },
                        {
                            q: "How many tokens exist?",
                            a: "1 billion total supply. No future mints, no drops, no vesting, fixed forever.",
                        },
                    ].map(({ q, a }, i) => (
                        <details
                            key={q}
                            className="group rounded-2xl border border-white/10 bg-brand-card p-5 transition-all duration-200 hover:border-brand-primary/40"
                        >
                            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-100 focus:outline-none">
                                {q}
                                <span className="ml-2 text-brand-primary transition-transform duration-200 group-open:rotate-45">
                                    +
                                </span>
                            </summary>
                            <div className="mt-2 text-slate-300/90 text-sm leading-snug">{a}</div>
                        </details>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 bg-brand-card/40">
                <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-400">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="text-center sm:text-left">
                            © {new Date().getFullYear()} Froggy Project. All rights reserved.
                        </div>

                        <nav className="flex flex-wrap items-center justify-center gap-4">
                            <a
                                href="https://x.com/frogonsei" // replace with your real link
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:text-brand-primary"
                            >
                                X / Twitter
                            </a>
                            <a
                                href="https://discord.gg/frogonsei" // replace with your real link
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:text-brand-primary"
                            >
                                Discord
                            </a>
                            <a
                                href="https://t.me/frogonsei" // replace with your real link
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:text-brand-primary"
                            >
                                Telegram
                            </a>
                            <a
                                href="/docs" // replace with your docs path
                                className="transition-colors hover:text-brand-primary"
                            >
                                Docs
                            </a>
                        </nav>
                    </div>
                </div>
            </footer>

        </div>
    );
}
