"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

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

const PAGE = 6;

export function GallerySection() {
    const [visibleCount, setVisibleCount] = useState(PAGE);
    const visibleItems = galleryItems.slice(0, visibleCount);

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(0);

    const openerRef = useRef<HTMLButtonElement | null>(null);
    const lightboxRootRef = useRef<HTMLDivElement | null>(null);
    const galleryRef = useRef<HTMLElement | null>(null);

    const startX = useRef<number | null>(null);

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 0) return;
        startX.current = e.touches[0].clientX;
    };

    const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (startX.current == null || e.changedTouches.length === 0) return;
        const dx = e.changedTouches[0].clientX - startX.current;

        if (dx > 40) setActiveIndex((i) => (i - 1 + galleryItems.length) % galleryItems.length);
        if (dx < -40) setActiveIndex((i) => (i + 1) % galleryItems.length);

        startX.current = null;
    };

    // Lightbox: keyboard controls + scroll lock + focus trap
    useEffect(() => {
        if (!lightboxOpen) {
            document.body.style.overflow = "";
            return;
        }

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const root = lightboxRootRef.current;
        const selector = 'a, button, [tabindex]:not([tabindex="-1"])';

        const getFocusables = () =>
            root
                ? Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
                    (el) => !el.hasAttribute("disabled"),
                )
                : [];

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setLightboxOpen(false);
                openerRef.current?.focus();
                return;
            }

            if (e.key === "ArrowRight") {
                setActiveIndex((i) => (i + 1) % galleryItems.length);
                return;
            }
            if (e.key === "ArrowLeft") {
                setActiveIndex((i) => (i - 1 + galleryItems.length) % galleryItems.length);
                return;
            }

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

        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [lightboxOpen]);

    return (
        <section
            ref={galleryRef}
            id="gallery"
            className="scroll-mt-20 mx-auto max-w-6xl px-4 pb-14"
        >
            <h2
                id="gallery-heading"
                className="text-2xl md:text-3xl font-bold"
            >
                Gallery
            </h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                On-brand poses of Froggy. Click to view full size.
            </p>

            {/* Grid */}
            <ul
                id="gallery-grid"
                className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4"
            >
                {visibleItems.map((item, i) => (
                    <li key={item.alt}>
                        <button
                            ref={i === activeIndex ? openerRef : undefined}
                            type="button"
                            onClick={() => {
                                setActiveIndex(i);
                                setLightboxOpen(true);
                            }}
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
                    {visibleCount < galleryItems.length && (
                        <button
                            type="button"
                            aria-controls="gallery-grid"
                            onClick={() =>
                                setVisibleCount((c) =>
                                    Math.min(c + PAGE, galleryItems.length),
                                )
                            }
                            className="rounded-lg px-4 py-2 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                        >
                            Show{" "}
                            {Math.min(PAGE, galleryItems.length - visibleCount)}{" "}
                            more
                        </button>
                    )}

                    {visibleCount > PAGE && (
                        <button
                            type="button"
                            onClick={() => {
                                setVisibleCount(PAGE);
                                setActiveIndex((i) => Math.min(i, PAGE - 1));
                                queueMicrotask(() =>
                                    galleryRef.current?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                    }),
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
                                    Viewing {galleryItems[activeIndex].alt} (
                                    {activeIndex + 1} of {galleryItems.length})
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
                                        onClick={() =>
                                            setActiveIndex(
                                                (i) =>
                                                    (i - 1 + galleryItems.length) %
                                                    galleryItems.length,
                                            )
                                        }
                                        aria-label="Previous image"
                                    >
                                        ← Prev
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg px-3 py-1 border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                        onClick={() =>
                                            setActiveIndex(
                                                (i) =>
                                                    (i + 1) % galleryItems.length,
                                            )
                                        }
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
    );
}
