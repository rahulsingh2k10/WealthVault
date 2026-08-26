"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface CarouselFeature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface FeatureCarouselProps {
  features: CarouselFeature[];
  cardBg: string;
  cardBorder: string;
  textPri: string;
  textSec: string;
  accent: string;
}

const AUTOPLAY_MS = 4000;
const RESUME_DELAY_MS = 5000;

/** Tints each card by stepping between the two shared UI accent colors. */
function iconPanelStyle(index: number, total: number): React.CSSProperties {
  const pct = total > 1 ? (index / (total - 1)) * 100 : 0;
  const tint = `color-mix(in srgb, var(--ui-accent) ${100 - pct}%, var(--ui-accent-warm) ${pct}%)`;
  return {
    background: `linear-gradient(160deg, color-mix(in srgb, ${tint} 32%, transparent), color-mix(in srgb, ${tint} 14%, transparent))`,
  };
}

/** Minimum width a card needs so its title always fits on one line at text-base. */
const MIN_CARD_WIDTH = 385;
/** Fixed card height (title + up to the description's own max-height + padding)
 * so every card is the same size regardless of how long its description is,
 * or which row it wraps to. */
const CARD_HEIGHT = 116;

function FeatureCard({
  icon: Icon,
  title,
  desc,
  index,
  total,
  cardBg,
  cardBorder,
  textPri,
  textSec,
  accent,
  className = "",
}: CarouselFeature &
  Pick<FeatureCarouselProps, "cardBg" | "cardBorder" | "textPri" | "textSec" | "accent"> & {
    index: number;
    total: number;
    className?: string;
  }) {
  return (
    <div
      className={`flex h-full overflow-hidden rounded-2xl ${className}`}
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        className="flex w-11 shrink-0 items-center justify-center"
        style={{ ...iconPanelStyle(index, total), borderRight: `1px solid ${cardBorder}` }}
      >
        {/* Same glow the "Truly One of a Kind" badge uses on its border,
            applied to the icon's own shape via drop-shadow instead of
            box-shadow (the icon has no box/border of its own). */}
        <Icon
          className="h-5 w-5 animate-icon-bob"
          style={{
            color: accent,
            animationDelay: `${index * 0.15}s`,
            filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--ui-accent) 55%, transparent))",
          }}
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center px-3 py-3">
        <h3 className="whitespace-nowrap text-base font-semibold" style={{ color: textPri }}>
          {title}
        </h3>
        {/* Description wraps to as many lines as it needs; once it exceeds the
            box it scrolls instead of clipping, so nothing is ever hidden. */}
        <p
          className="mt-1 max-h-[4.5em] overflow-y-auto text-[13px] leading-relaxed"
          style={{ color: textSec }}
        >
          {desc}
        </p>
      </div>
    </div>
  );
}

/**
 * Feature showcase, responsive by breakpoint:
 *  - lg+   : fixed row, all cards visible, nothing scrolls
 *  - sm–lg : manual horizontal scroll, snaps per card
 *  - <sm   : one card at a time, auto-advances (pauses on touch/click, then resumes)
 */
export default function FeatureCarousel({
  features,
  cardBg,
  cardBorder,
  textPri,
  textSec,
  accent,
}: FeatureCarouselProps) {
  const total = features.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(0);
  const [autoplayPaused, setAutoplayPaused] = useState(false);

  const scrollToIndex = (i: number) => {
    const child = trackRef.current?.children[i] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  useEffect(() => {
    if (autoplayPaused) return;
    const id = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % total;
        scrollToIndex(next);
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [autoplayPaused, total]);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  const pauseThenResume = () => {
    setAutoplayPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setAutoplayPaused(false), RESUME_DELAY_MS);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive((prev) => (prev === index ? prev : index));
  };

  const cardProps = { cardBg, cardBorder, textPri, textSec, accent };

  return (
    <div>
      {/* Large screens: fixed, all visible, nothing scrolls. Every card is a fixed
          MIN_CARD_WIDTH — the smallest size that still fits the longest title
          ("Real-Time Performance Tracking") on one line — so cards never stretch
          to fill leftover row space. Row count adapts to the real window width;
          whatever doesn't fit wraps to another row instead of being squeezed. */}
      <div className="hidden flex-wrap justify-center gap-16 lg:flex">
        {features.map((f, i) => (
          <div key={f.title} style={{ width: MIN_CARD_WIDTH, height: CARD_HEIGHT }} className="shrink-0">
            <FeatureCard {...f} {...cardProps} index={i} total={total} className="transition hover:scale-[1.02]" />
          </div>
        ))}
      </div>

      {/* Medium screens: manual horizontal scroll, snaps per card */}
      <div className="hidden snap-x gap-6 overflow-x-auto pb-2 sm:flex lg:hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {features.map((f, i) => (
          <div key={f.title} style={{ width: MIN_CARD_WIDTH, height: CARD_HEIGHT }} className="shrink-0 snap-start">
            <FeatureCard {...f} {...cardProps} index={i} total={total} />
          </div>
        ))}
      </div>

      {/* Small screens: one at a time, auto-advancing */}
      <div className="sm:hidden">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onTouchStart={pauseThenResume}
          onPointerDown={pauseThenResume}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          {features.map((f, i) => (
            <div key={f.title} style={{ height: CARD_HEIGHT }} className="w-full shrink-0 snap-start">
              <FeatureCard {...f} {...cardProps} index={i} total={total} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {features.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => {
                scrollToIndex(i);
                setActive(i);
                pauseThenResume();
              }}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: active === i ? 18 : 6,
                background: active === i ? accent : "var(--ui-card-border)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
