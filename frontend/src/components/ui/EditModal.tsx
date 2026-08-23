"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  loading?: boolean;
}

export function EditModal({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = "Save Changes",
  loading = false,
}: EditModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 max-h-[90vh] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit}>
          <div className="px-5 py-4">{children}</div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors",
                loading && "opacity-60 cursor-not-allowed"
              )}
            >
              {loading ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Form field helper ──────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  value?: string | number;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  step?: string;
  readOnly?: boolean;
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  value,
  onChange,
  required,
  placeholder,
  step,
  readOnly,
}: FieldProps) {
  const isControlled = value !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {readOnly && <span className="ml-1 text-slate-400 font-normal">(auto)</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        {...(isControlled ? { value } : { defaultValue })}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        required={required}
        placeholder={placeholder}
        step={step}
        readOnly={readOnly}
        className={cn(
          "rounded-md border px-3 py-2 text-sm focus:outline-none",
          readOnly
            ? "border-slate-200 bg-slate-100 text-slate-500 cursor-default dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-400"
            : "border-slate-200 bg-white text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        )}
      />
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

// ── Select field helper ────────────────────────────────────────────────────

interface SelectFieldProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}

export function SelectField({
  label,
  name,
  options,
  value,
  defaultValue,
  required,
  onChange,
}: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        required={required}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
