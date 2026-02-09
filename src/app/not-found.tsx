import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen w-full px-6 py-16 flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl border border-white/10 bg-black/20 p-6">
                <h1 className="text-xl font-semibold">Page not found</h1>
                <p className="mt-2 text-sm text-white/70">
                    Either the link is wrong, or the page got moved.
                </p>

                <div className="mt-5">
                    <Link
                        href="/"
                        className="inline-flex rounded-xl px-4 py-2 text-sm font-semibold bg-brand-primary text-black hover:opacity-90 transition"
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}