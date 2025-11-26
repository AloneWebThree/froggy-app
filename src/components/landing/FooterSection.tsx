"use client";

export function FooterSection() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-white/10 bg-brand-card/40">
            <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-400">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="text-center sm:text-left">
                        © {year} Froggy Project. All rights reserved.
                    </div>

                    <nav className="flex flex-wrap items-center justify-center gap-4">
                        <a
                            href="https://x.com/frogonsei"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-brand-primary"
                        >
                            X / Twitter
                        </a>
                        <a
                            href="#"
                            className="transition-colors hover:text-brand-primary"
                        >
                            Discord (coming soon)
                        </a>
                        <a
                            href="https://t.me/frogonsei"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-brand-primary"
                        >
                            Telegram
                        </a>
                        <a
                            href="/docs"
                            className="transition-colors hover:text-brand-primary"
                        >
                            Docs
                        </a>
                    </nav>
                </div>
            </div>
        </footer>
    );
}
