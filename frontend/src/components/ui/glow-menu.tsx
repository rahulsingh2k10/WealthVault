/**
 * MenuBar — floating glow/flip nav bar. Adapted from a community snippet;
 * shadcn tokens (bg-background, border-border, text-foreground,
 * text-muted-foreground) remapped to this app's --ui-* tokens, which are
 * consumed unwrapped (no hsl()).
 *
 * The source built its hover icon-tint via `` `group-hover:${item.iconColor}` ``
 * — a runtime-concatenated Tailwind class. Tailwind's JIT only generates CSS
 * for classes that appear as complete literal strings in scanned source, so
 * that combined variant class never gets generated and the tint would never
 * actually show. Fixed by applying each item's color directly instead of
 * conditionally on hover.
 */
"use client"

import * as React from "react"
import { motion, type Variants, type Transition } from "framer-motion"
import { cn } from "@/lib/utils"

interface MenuItem {
  icon: React.ElementType
  label: string
  href: string
  gradient: string
  iconColor: string
}

// Omits the handful of DOM event props (onDrag, onAnimationStart, …) whose
// React.HTMLAttributes signature conflicts with framer-motion's own —
// spreading a plain HTMLAttributes object onto <motion.nav> needs this.
interface MenuBarProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
  > {
  items: MenuItem[]
  activeItem?: string
  onItemClick?: (label: string) => void
}

const itemVariants: Variants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
}

const backVariants: Variants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
}

const glowVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  hover: {
    opacity: 1,
    scale: 2,
    transition: {
      opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.5, type: "spring", stiffness: 300, damping: 25 },
    },
  },
}

const navGlowVariants: Variants = {
  initial: { opacity: 0 },
  hover: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
}

const sharedTransition: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
  duration: 0.5,
}

export const MenuBar = React.forwardRef<HTMLDivElement, MenuBarProps>(
  ({ className, items, activeItem, onItemClick, ...props }, ref) => {
    return (
      <motion.nav
        ref={ref}
        className={cn(
          // overflow-x alone makes the browser compute overflow-y as auto too
          // (CSS overflow spec) — pin it shut so only horizontal scroll is possible.
          "p-2 rounded-2xl bg-[var(--ui-card-bg)] backdrop-blur-lg border border-[var(--ui-card-border)] shadow-[var(--ui-card-shadow)] relative overflow-x-auto overflow-y-hidden scrollbar-none",
          className,
        )}
        initial="initial"
        whileHover="hover"
        {...props}
      >
        <motion.div
          className="absolute -inset-2 bg-[radial-gradient(ellipse_at_center,var(--ui-accent-bg)_0%,transparent_70%)] rounded-3xl z-0 pointer-events-none"
          variants={navGlowVariants}
        />
        <ul className="flex items-center justify-center gap-2 relative z-10 w-max min-w-full">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = item.label === activeItem

            return (
              <motion.li key={item.label} className="relative shrink-0">
                <button
                  onClick={() => onItemClick?.(item.label)}
                  className="block w-full"
                >
                  <motion.div
                    className="block rounded-xl overflow-visible group relative"
                    style={{ perspective: "600px" }}
                    whileHover="hover"
                    initial="initial"
                  >
                    <motion.div
                      className="absolute inset-0 z-0 pointer-events-none"
                      variants={glowVariants}
                      animate={isActive ? "hover" : "initial"}
                      style={{
                        background: item.gradient,
                        opacity: isActive ? 1 : 0,
                        borderRadius: "16px",
                      }}
                    />
                    <motion.div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 relative z-10 bg-transparent transition-colors rounded-xl whitespace-nowrap",
                        isActive
                          ? "text-[var(--ui-text-pri)]"
                          : "text-[var(--ui-text-sec)] group-hover:text-[var(--ui-text-pri)]",
                      )}
                      variants={itemVariants}
                      transition={sharedTransition}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center bottom",
                      }}
                    >
                      <span className={cn("transition-colors duration-300", item.iconColor)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="relative inline-block">
                        {item.label}
                        {isActive && (
                          <span className="absolute inset-x-1/4 -bottom-1 h-0.5 rounded-full bg-current" />
                        )}
                      </span>
                    </motion.div>
                    <motion.div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 absolute inset-0 z-10 bg-transparent transition-colors rounded-xl whitespace-nowrap",
                        isActive
                          ? "text-[var(--ui-text-pri)]"
                          : "text-[var(--ui-text-sec)] group-hover:text-[var(--ui-text-pri)]",
                      )}
                      variants={backVariants}
                      transition={sharedTransition}
                      style={{
                        transformStyle: "preserve-3d",
                        transformOrigin: "center top",
                        rotateX: 90,
                      }}
                    >
                      <span className={cn("transition-colors duration-300", item.iconColor)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="relative inline-block">
                        {item.label}
                        {isActive && (
                          <span className="absolute inset-x-1/4 -bottom-1 h-0.5 rounded-full bg-current" />
                        )}
                      </span>
                    </motion.div>
                  </motion.div>
                </button>
              </motion.li>
            )
          })}
        </ul>
      </motion.nav>
    )
  },
)

MenuBar.displayName = "MenuBar"
