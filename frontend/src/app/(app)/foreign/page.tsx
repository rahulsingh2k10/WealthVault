'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { pnlClass, formatChangeRatio } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { ForeignHolding } from '@/lib/types'

export default function ForeignPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<ForeignHolding>('/api/foreign')

  const [editRow, setEditRow] = useState<ForeignHolding | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qty, setQty] = useState('')
  const [avgCostUsd, setAvgCostUsd] = useState('')
  const [currentPriceUsd, setCurrentPriceUsd] = useState('')

  const purchaseAmountUsd = (parseFloat(qty) || 0) * (parseFloat(avgCostUsd) || 0)
  const currentAmountUsd  = (parseFloat(qty) || 0) * (parseFloat(currentPriceUsd) || 0)
  const pnlUsd            = currentAmountUsd - purchaseAmountUsd

  const fmtUsd = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(v)

  const columns: Column<ForeignHolding>[] = [
    { key: 'instrument',       label: 'Stock',      className: 'font-semibold' },
    { key: 'quantity',         label: 'Qty',         render: (v) => Number(v).toFixed(4) },
    { key: 'avgCostUsd',       label: 'Avg Cost',    render: (v) => fmtUsd(Number(v)) },
    { key: 'currentPriceUsd',  label: 'Curr Price',  render: (v) => fmtUsd(Number(v)) },
    { key: 'purchaseAmountUsd',label: 'Invested',    render: (v) => fmtUsd(Number(v)) },
    { key: 'currentAmountUsd', label: 'Current',     render: (v) => fmtUsd(Number(v)) },
    { key: 'pnlUsd', label: 'P&L', render: (v) => <span className={pnlClass(Number(v))}>{Number(v) >= 0 ? '+' : ''}{fmtUsd(Number(v))}</span> },
    { key: 'netChange', label: 'Return', render: (v) => <Badge variant={Number(v) >= 0 ? 'gain' : 'loss'}>{formatChangeRatio(Number(v))}</Badge> },
    { key: 'platform', label: 'Platform' },
  ]

  const totalInvestedUsd = data.reduce((acc, h) => acc + h.purchaseAmountUsd, 0)
  const currentValueUsd  = data.reduce((acc, h) => acc + h.currentAmountUsd, 0)
  const totalPnlUsd      = currentValueUsd - totalInvestedUsd

  const openAdd  = () => { setEditRow(null); setQty(''); setAvgCostUsd(''); setCurrentPriceUsd(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  const handleEdit = (row: ForeignHolding) => {
    setEditRow(row)
    setQty(String(row.quantity))
    setAvgCostUsd(String(row.avgCostUsd))
    setCurrentPriceUsd(String(row.currentPriceUsd))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:        fd.get('instrument') as string,
      quantity:          parseFloat(qty),
      avgCostUsd:        parseFloat(avgCostUsd),
      purchaseAmountUsd,
      currentPriceUsd:   parseFloat(currentPriceUsd),
      currentAmountUsd,
      pnlUsd,
      netChange:         purchaseAmountUsd > 0 ? (currentAmountUsd - purchaseAmountUsd) / purchaseAmountUsd : 0,
      platform:          fd.get('platform') as string,
    }
    if (editRow) {
      await update(editRow.id, fields)
    } else {
      await create(fields)
    }
    setSaving(false)
    closeModal()
  }

  return (
    <AppShell title="Foreign Holdings" subtitle="US stocks via IndMoney and Vested">
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Invested',      value: fmtUsd(totalInvestedUsd) },
          { label: 'Current Value', value: fmtUsd(currentValueUsd) },
          { label: 'P&L', value: `${totalPnlUsd >= 0 ? '+' : ''}${fmtUsd(totalPnlUsd)}`, cls: pnlClass(totalPnlUsd) },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-1 text-lg font-bold ${item.cls ?? 'text-slate-900 dark:text-slate-50'}`}>{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable data={data} columns={columns} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} addLabel="Add Entry" />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? 'Edit Entry' : 'Add New Entry'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <Field label="Stock Name"           name="instrument"       required defaultValue={editRow?.instrument}  placeholder="AAPL / GOOGL" />
          <Field label="Platform"             name="platform"         required defaultValue={editRow?.platform}    placeholder="IndMoney / Vested" />
          <Field label="Quantity"             name="quantity"         type="number" step="0.0001" required value={qty}             onChange={setQty} />
          <Field label="Avg Cost ($)"         name="avgCostUsd"       type="number" step="0.01" required value={avgCostUsd}       onChange={setAvgCostUsd} />
          <Field label="Purchase Amount ($)"  name="purchaseAmountUsd" type="number" step="0.01" value={purchaseAmountUsd.toFixed(2)} readOnly />
          <Field label="Current Price ($)"    name="currentPriceUsd"  type="number" step="0.01" required value={currentPriceUsd}  onChange={setCurrentPriceUsd} />
          <Field label="Current Amount ($)"   name="currentAmountUsd" type="number" step="0.01" value={currentAmountUsd.toFixed(2)} readOnly />
          <Field label="P&L ($)"              name="pnlUsd"           type="number" step="0.01" value={pnlUsd.toFixed(2)} readOnly />
        </FieldGrid>
      </EditModal>
    </AppShell>
  )
}
