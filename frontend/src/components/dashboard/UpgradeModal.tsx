"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { UpgradePlanPicker } from "./UpgradePlanPicker";
import type { PlanCardView } from "@/lib/services/UpgradePromptService";

interface UpgradeModalProps {
  open: boolean;
  plans: PlanCardView[];
  memberCount: number | null;
  onClose: () => void;
  onSubscribed?: () => void;
}

export function UpgradeModal({ open, plans, memberCount, onClose, onSubscribed }: UpgradeModalProps) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="upgrade-backdrop"
            className="fixed inset-0 z-40 backdrop-blur-[3px]"
            style={{ background: "rgba(20,10,40,0.45)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35 }}
            onClick={() => { if (!submitting) onClose(); }}
          />
          <motion.div
            key="upgrade-panel"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none sm:p-6"
            initial={{ opacity: 0, y: 14, scale: reduceMotion ? 1 : 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: reduceMotion ? 1 : 0.94 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrade-modal-title"
              tabIndex={-1}
              className="pointer-events-auto relative flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl outline-none"
              style={{
                maxHeight: "calc(100dvh - 3rem)",
                background: "var(--ui-modal-bg)",
                boxShadow: "var(--ui-modal-shadow)",
              }}
            >
              <button
                onClick={() => { if (!submitting) onClose(); }}
                aria-label="Close"
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--ui-text-muted)] hover:text-[color:var(--ui-text-sec)]"
                style={{ background: "var(--ui-subtle-bg)" }}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <UpgradePlanPicker
                  plans={plans}
                  memberCount={memberCount}
                  onClose={onClose}
                  onSubscribed={onSubscribed}
                  onSubmittingChange={setSubmitting}
                />
                <button
                  onClick={() => { if (!submitting) onClose(); }}
                  className="mx-auto mb-6 block text-[0.78rem] text-[color:var(--ui-text-muted)] underline"
                >
                  {t.upgrade.maybeLater}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
