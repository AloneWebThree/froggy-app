"use client";

export type DonutSlice = {
    label: string;
    value: number;
    color: string;
};

interface DonutProps {
    data: DonutSlice[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
}

export function Donut({
    data,
    size = 220, // default so it actually fills the cards
    thickness = 18,
    centerLabel,
}: DonutProps) {
    const total = data.reduce((a, b) => a + b.value, 0) || 1;

    // build conic-gradient stops
    const stops = data
        .reduce<{ segs: string[]; acc: number }>(
            (st, s) => {
                const start = (st.acc / total) * 100;
                const end = ((st.acc + s.value) / total) * 100;
                st.segs.push(`${s.color} ${start}% ${end}%`);
                return { segs: st.segs, acc: st.acc + s.value };
            },
            { segs: [], acc: 0 }
        )
        .segs.join(", ");

    const mask = `radial-gradient(
    closest-side,
    transparent calc(100% - ${thickness + 1}px),
    rgba(0, 0, 0, 0.7) calc(100% - ${thickness}px),
    #000 calc(100% - ${thickness - 1}px)
    )`;

    return (
        <div className="flex flex-col items-center gap-12 md:flex-row md:items-center md:gap-24">
            {/* Donut ring */}
            <div
                className="relative rounded-full shrink-0"
                role="img"
                aria-label={centerLabel ? `${centerLabel} distribution` : "distribution"}
                style={{
                    width: size,
                    height: size,
                    WebkitMaskComposite: "source-in",
                    maskComposite: "intersect",
                }}
            >
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background: `conic-gradient(${stops})`,
                        WebkitMask: mask,
                        mask,
                        transform: "rotate(-90deg)",
                        boxShadow: "0 0 0 2px rgba(0,0,0,0.35) inset",
                    }}
                />
                {centerLabel && (
                    <div className="absolute inset-0 grid place-items-center text-base font-semibold pointer-events-none">
                        {centerLabel}
                    </div>
                )}
            </div>

            {/* Legend */}
            <ul className="grid w-full max-w-sm grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {data.map((s) => (
                    <li key={s.label} className="flex items-center gap-2">
                        <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ background: s.color }}
                        />
                        <span className="text-slate-300/90">{s.label}</span>
                        <span className="ml-auto font-semibold min-w-[2.5rem] text-right">
                            {Math.round((s.value / total) * 100)}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
