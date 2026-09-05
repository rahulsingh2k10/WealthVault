"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  question?: string;
  continueLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onContinue: () => void;
}

/**
 * The app-wide replacement for window.confirm(): a Continue/Cancel sheet
 * matching the rest of the subscription UI, instead of the browser's
 * native alert. Reused everywhere a yes/no confirmation is needed.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  question,
  continueLabel = "Continue",
  cancelLabel = "Cancel",
  onCancel,
  onContinue,
}: ConfirmDialogProps) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="confirm-backdrop"
            className="fixed inset-0 z-[60] backdrop-blur-[3px]"
            style={{ background: "rgba(20,10,40,0.45)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            onClick={onCancel}
          />
          <motion.div
            key="confirm-panel"
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, y: 10, scale: reduceMotion ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: reduceMotion ? 1 : 0.96 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              className="pointer-events-auto w-full max-w-[400px] rounded-2xl border p-6"
              style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)", borderColor: "var(--ui-accent-border)" }}
            >
              <h2 id="confirm-dialog-title" className="text-[1.05rem] font-bold text-[color:var(--ui-text-pri)]">
                {title}
              </h2>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-[color:var(--ui-text-sec)]">
                {body}
              </p>
              {question && (
                <p className="mt-2 text-[0.82rem] font-semibold text-[color:var(--ui-text-pri)]">
                  {question}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={onCancel}
                  className="rounded-lg border px-4 py-2 text-[0.78rem] font-bold"
                  style={{ borderColor: "var(--ui-card-border)", color: "var(--ui-text-sec)" }}
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onContinue}
                  className="rounded-lg px-4 py-2 text-[0.78rem] font-bold"
                  style={{
                    background: "linear-gradient(135deg, var(--ui-accent), var(--ui-accent-warm))",
                    color: "var(--ui-on-accent)",
                  }}
                >
                  {continueLabel}
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
