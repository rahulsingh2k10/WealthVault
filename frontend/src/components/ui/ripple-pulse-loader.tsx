/**
 * RipplePulseLoader — branded full-screen/section loader.
 * Adapted from a community snippet; the placeholder logo mark is swapped for
 * this app's lock glyph, and colors are remapped to the --ui-* token system.
 */
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface RipplePulseLoaderProps {
  caption?: string;
  subCaption?: string;
  className?: string;
}

const SATELLITES: { position: string; vars: React.CSSProperties; delay: string }[] = [
  { position: "left-1/2 top-1.5", vars: { "--tx": "-50%" } as React.CSSProperties, delay: "150ms" },
  { position: "right-1.5 top-1/2", vars: { "--ty": "-50%" } as React.CSSProperties, delay: "300ms" },
  { position: "left-1/2 bottom-1.5", vars: { "--tx": "-50%" } as React.CSSProperties, delay: "450ms" },
  { position: "left-1.5 top-1/2", vars: { "--ty": "-50%" } as React.CSSProperties, delay: "600ms" },
];

export function RipplePulseLoader({ caption, subCaption, className }: RipplePulseLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="relative h-[168px] w-[168px]">
        {SATELLITES.map(({ position, vars, delay }, i) => (
          <div
            key={i}
            className={cn(
              "absolute h-10 w-10 animate-rp-ripple rounded-[14px] border border-[var(--ui-card-border)] bg-[var(--ui-card-bg)]",
              position
            )}
            style={{ animationDelay: delay, ...vars }}
          />
        ))}
        <div
          className="absolute left-1/2 top-1/2 z-[2] flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--ui-card-border)] bg-[var(--ui-accent-bg)] animate-rp-ripple"
          style={{ "--tx": "-50%", "--ty": "-50%" } as React.CSSProperties}
        >
          <Lock className="h-6 w-6 animate-rp-glyph-pulse" />
        </div>
      </div>
      {(caption || subCaption) && (
        <div className="text-center">
          {caption && <p className="text-sm font-semibold text-[var(--ui-text-pri)]">{caption}</p>}
          {subCaption && <p className="mt-0.5 text-xs text-[var(--ui-text-sec)]">{subCaption}</p>}
        </div>
      )}
    </div>
  );
}

export default RipplePulseLoader;
