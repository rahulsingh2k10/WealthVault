"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T extends { id: number }> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (id: number) => void;
  onAdd?: () => void;
  addLabel?: string;
  searchPlaceholder?: string;
  searchKey?: keyof T;
  loading?: boolean;
}

export function DataTable<T extends { id: number }>({
  data,
  columns,
  onEdit,
  onDelete,
  onAdd,
  addLabel = "Add New",
  searchPlaceholder = "Search...",
  searchKey,
  loading = false,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");

  const filtered = searchKey
    ? data.filter((row) => {
        const val = row[searchKey];
        return String(val ?? "").toLowerCase().includes(search.toLowerCase());
      })
    : data;

  const showActions = !!(onEdit || onDelete);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {searchKey && (
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
        )}
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
                    col.headerClassName
                  )}
                >
                  {col.label}
                </th>
              ))}
              {showActions && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <div className="h-4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showActions ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  No data found
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {columns.map((col) => {
                    const rawValue = row[col.key as keyof T];
                    return (
                      <td
                        key={String(col.key)}
                        className={cn(
                          "px-4 py-3 text-sm text-slate-700 dark:text-slate-300",
                          col.className
                        )}
                      >
                        {col.render ? col.render(rawValue, row) : String(rawValue ?? "")}
                      </td>
                    );
                  })}
                  {showActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => {
                              if (confirm("Delete this entry?")) onDelete(row.id);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Row count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} {filtered.length === 1 ? "row" : "rows"}
          {searchKey && search && ` matching "${search}"`}
        </p>
      )}
    </div>
  );
}
