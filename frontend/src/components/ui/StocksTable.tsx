"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Edit2, Trash2, Plus, TrendingUp, TrendingDown,
  Search, Minus, ChevronLeft, ChevronRight,
} from "lucide-react";
import { formatChangeRatio, pnlClass } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import type { StockHolding } from "@/lib/types";

const PAGE_SIZE = 20;

interface StocksTableProps {
  data: StockHolding[];
  loading?: boolean;
  onEdit: (row: StockHolding) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

// Row entry animation — opacity + x only.
// filter/scale deliberately removed: they create GPU compositing layers that
// go stale on browser zoom, causing the entire layout to visually distort.
const rowVariants = {
  hidden:  { opacity: 0, x: -16 },
  visible: {
    opacity: 1, x: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 28, mass: 0.6 },
  },
};

// Shared <td> base — no overflow restrictions so content is never hidden.
// group-hover changes background; no JS transform on <tr> (unreliable across zoom).
const tdBase  = "whitespace-nowrap px-3 py-3 bg-muted/50 border-y border-border/50 text-sm transition-colors group-hover:bg-muted/80";
const tdFirst = `${tdBase} pl-4 border-l rounded-l-xl`;
const tdLast  = `${tdBase} pr-4 border-r rounded-r-xl`;

export function StocksTable({ data, loading, onEdit, onDelete, onAdd }: StocksTableProps) {
  const { format } = useCurrency();
  const [selectedStock, setSelectedStock] = useState<StockHolding | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = search
    ? data.filter(
        (s) =>
          s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.instrument.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getPnlGradient = (pnl: number) =>
    pnl > 0  ? "from-green-500/10 to-transparent"
    : pnl < 0 ? "from-red-500/10 to-transparent"
    : "from-slate-500/5 to-transparent";

  const getPnlBadge = (pnl: number) => {
    if (pnl > 0)
      return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/30">
          <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />
          <span className="text-green-400 text-xs font-medium">Gain</span>
        </div>
      );
    if (pnl < 0)
      return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-red-400 text-xs font-medium">Loss</span>
        </div>
      );
    return (
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-500/10 border border-slate-500/30">
        <Minus className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="text-slate-400 text-xs font-medium">Flat</span>
      </div>
    );
  };

  const getNetChangeBars = (netChange: number) => {
    const pct = Math.min(Math.abs(netChange) * 100, 100);
    const filledBars = Math.round((pct / 100) * 10);
    const isGain = netChange >= 0;
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 shrink-0">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 h-4 rounded-full transition-all duration-500 ${
                i < filledBars
                  ? isGain ? "bg-green-400/70" : "bg-red-400/70"
                  : "bg-muted/40 border border-border/30"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-mono font-semibold whitespace-nowrap ${isGain ? "text-green-400" : "text-red-400"}`}>
          {formatChangeRatio(netChange)}
        </span>
      </div>
    );
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name or symbol..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <motion.button
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shrink-0"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Stock
        </motion.button>
      </div>

      {/* ── Desktop / Tablet: auto-sized table, horizontally scrollable ───────
          table-layout: auto means the browser measures every cell in every row
          and sets each column exactly as wide as its widest content.
          No truncation is possible by construction. overflow-x-auto handles
          viewports narrower than the natural table width.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table
          className="w-full"
          style={{ borderCollapse: "separate", borderSpacing: "0 6px" }}
        >
          {/* Column headers */}
          <thead>
            <tr>
              {[
                "Name / Symbol",
                "Qty",
                "Avg. Price",
                "Invested Amt",
                "LTV",
                "Current Amt",
                "Net Change",
                "P&L",
              ].map((h, i, arr) => (
                <th
                  key={h}
                  className={`whitespace-nowrap pb-1 pt-0 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider
                    ${i === 0 ? "pl-4 pr-3" : i === arr.length - 1 ? "pl-3 pr-4" : "px-3"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* Animated rows */}
          <motion.tbody
            variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }}
            initial="hidden"
            animate="visible"
          >
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                  {search ? `No results for "${search}"` : "No stocks added yet."}
                </td>
              </tr>
            ) : (
              paginated.map((stock) => (
                <motion.tr
                  key={stock.id}
                  variants={rowVariants}
                  className="cursor-pointer group"
                  onClick={() => setSelectedStock(stock)}
                >
                  {/* Name + Symbol */}
                  <td className={tdFirst}>
                    <div className="font-medium text-foreground leading-tight">
                      {stock.name ?? "—"}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {stock.instrument}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className={tdBase}>
                    <span className="font-mono text-foreground tabular-nums">
                      {Number(stock.quantity).toLocaleString()}
                    </span>
                  </td>

                  {/* Avg. Price */}
                  <td className={tdBase}>
                    <span className="font-mono text-foreground tabular-nums">
                      {format(stock.avgCost, true)}
                    </span>
                  </td>

                  {/* Invested Amount */}
                  <td className={tdBase}>
                    <span className="font-mono text-foreground tabular-nums">
                      {format(stock.purchaseAmount, true)}
                    </span>
                  </td>

                  {/* Last Traded Value */}
                  <td className={tdBase}>
                    <span className="font-mono text-foreground tabular-nums">
                      {format(stock.currentPrice, true)}
                    </span>
                  </td>

                  {/* Current Amount */}
                  <td className={tdBase}>
                    <span className="font-mono text-foreground tabular-nums">
                      {format(stock.currentAmount, true)}
                    </span>
                  </td>

                  {/* Net Change */}
                  <td className={tdBase}>
                    {getNetChangeBars(stock.netChange)}
                  </td>

                  {/* P&L badge — last cell carries the right-side gradient */}
                  <td className={`${tdLast} relative overflow-hidden`}>
                    <div
                      className={`absolute inset-0 bg-gradient-to-l ${getPnlGradient(stock.pnl)} pointer-events-none`}
                    />
                    <div className="relative">
                      {getPnlBadge(stock.pnl)}
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </motion.tbody>
        </table>
      </div>

      {/* ── Mobile: card list (< 640px) ─────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {paginated.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {search ? `No results for "${search}"` : "No stocks added yet."}
          </div>
        ) : (
          paginated.map((stock) => (
            <motion.div
              key={stock.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-muted/50 border border-border/50 rounded-xl p-4 overflow-hidden cursor-pointer active:opacity-80"
              onClick={() => setSelectedStock(stock)}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-l ${getPnlGradient(stock.pnl)} pointer-events-none`}
                style={{ backgroundSize: "30% 100%", backgroundPosition: "right", backgroundRepeat: "no-repeat" }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground">{stock.name ?? "—"}</div>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">
                    {stock.instrument} · {stock.platform}
                  </div>
                </div>
                {getPnlBadge(stock.pnl)}
              </div>
              <div className="relative mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                {[
                  { label: "Current Amt", value: format(stock.currentAmount, true), cls: "font-semibold text-foreground" },
                  { label: "Invested",    value: format(stock.purchaseAmount, true), cls: "text-foreground" },
                  {
                    label: "Net Change",
                    value: formatChangeRatio(stock.netChange),
                    cls: `font-semibold ${stock.netChange >= 0 ? "text-green-400" : "text-red-400"}`,
                  },
                  { label: "Qty", value: Number(stock.quantity).toLocaleString(), cls: "text-foreground" },
                ].map((item) => (
                  <div key={item.label} className="min-w-0">
                    <div className="text-muted-foreground mb-0.5">{item.label}</div>
                    <div className={`font-mono whitespace-nowrap overflow-hidden ${item.cls}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ── Footer: row count + pagination ───────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "stock" : "stocks"}
            {search && ` matching "${search}"`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Detail overlay — full precision numbers ───────────────────────────── */}
      <AnimatePresence>
        {selectedStock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col rounded-2xl z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-muted/60 to-transparent p-4 border-b border-border/30 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-foreground">
                    {selectedStock.name ?? selectedStock.instrument}
                  </h3>
                  {getPnlBadge(selectedStock.pnl)}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-sm font-mono text-muted-foreground">{selectedStock.instrument}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-sm text-muted-foreground">{selectedStock.platform}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <motion.button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-sm transition-colors"
                  onClick={() => { setSelectedStock(null); onEdit(selectedStock); }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </motion.button>
                <motion.button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm transition-colors"
                  onClick={() => { setSelectedStock(null); onDelete(selectedStock.id); }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </motion.button>
                <motion.button
                  className="w-8 h-8 bg-background/80 hover:bg-background rounded-full flex items-center justify-center border border-border/50 ml-1"
                  onClick={() => setSelectedStock(null)}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Body — always full precision, break-all for extreme values */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Quantity",          value: Number(selectedStock.quantity).toLocaleString() },
                  { label: "Avg. Price",         value: format(selectedStock.avgCost) },
                  { label: "Last Traded Value",  value: format(selectedStock.currentPrice) },
                  { label: "Platform",           value: selectedStock.platform },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</div>
                    <div className="text-sm font-mono font-semibold mt-1 text-foreground break-all">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Invested Amount", value: format(selectedStock.purchaseAmount), cls: "" },
                  { label: "Current Amount",  value: format(selectedStock.currentAmount),  cls: "" },
                  {
                    label: "P&L",
                    value: `${selectedStock.pnl >= 0 ? "+" : ""}${format(selectedStock.pnl)}`,
                    cls: pnlClass(selectedStock.pnl),
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</div>
                    <div className={`text-sm font-mono font-semibold mt-1 break-all ${item.cls || "text-foreground"}`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Net Change</div>
                {getNetChangeBars(selectedStock.netChange)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
