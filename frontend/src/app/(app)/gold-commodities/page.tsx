'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { CategoryBanner } from '@/components/ui/CategoryBanner'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatChangeRatio, pnlClass } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { GoldHolding } from '@/lib/types'

export default function GoldCommoditiesPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<GoldHolding>('/api/gold-commodities')

  const [editRow, setEditRow] = useState<GoldHolding | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qty, setQty] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')

  const purchaseAmount = (parseFloat(qty) || 0) * (parseFloat(avgCost) || 0)
  const currentAmount  = (parseFloat(qty) || 0) * (parseFloat(currentPrice) || 0)

  const columns: Column<GoldHolding>[] = [
    { key: 'instrument',     label: 'Name' },
    { key: 'type',           label: 'Type' },
    { key: 'quantity',       label: 'Qty',        render: (v) => Number(v).toLocaleString() },
    { key: 'unit',           label: 'Unit' },
    { key: 'avgCost',        label: 'Avg Cost',   render: (v) => format(Number(v)) },
    { key: 'currentPrice',   label: 'Curr Price', render: (v) => format(Number(v)) },
    { key: 'purchaseAmount', label: 'Invested',   render: (v) => format(Number(v)) },
    { key: 'currentAmount',  label: 'Current',    render: (v) => format(Number(v)) },
    { key: 'pnl', label: 'P&L', render: (v) => <span className={pnlClass(Number(v))}>{Number(v) >= 0 ? '+' : ''}{format(Number(v))}</span> },
    { key: 'netChange', label: 'Return', render: (v) => <Badge variant={Number(v) >= 0 ? 'gain' : 'loss'}>{formatChangeRatio(Number(v))}</Badge> },
    { key: 'platform', label: 'Platform' },
  ]

  const totals = data.reduce((acc, h) => ({ invested: acc.invested + h.purchaseAmount, current: acc.current + h.currentAmount, pnl: acc.pnl + h.pnl }), { invested: 0, current: 0, pnl: 0 })

  const openAdd    = () => { setEditRow(null); setQty(''); setAvgCost(''); setCurrentPrice(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  const handleEdit = (row: GoldHolding) => {
    setEditRow(row)
    setQty(String(row.quantity))
    setAvgCost(String(row.avgCost))
    setCurrentPrice(String(row.currentPrice))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:    fd.get('instrument') as string,
      type:          fd.get('type') as string,
      quantity:      parseFloat(qty),
      unit:          fd.get('unit') as string,
      avgCost:       parseFloat(avgCost),
      purchaseAmount,
      currentPrice:  parseFloat(currentPrice),
      currentAmount,
      pnl:           currentAmount - purchaseAmount,
      netChange:     purchaseAmount > 0 ? (currentAmount - purchaseAmount) / purchaseAmount : 0,
      platform:      fd.get('platform') as string,
    }
    if (editRow) { await update(editRow.id, fields) } else { await create(fields) }
    setSaving(false)
    closeModal()
  }

  return (
    <AppShell title="Gold & Commodities">
      <CategoryBanner slug="gold-commodities" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Invested',      value: format(totals.invested) },
          { label: 'Current Value', value: format(totals.current) },
          { label: 'P&L', value: `${totals.pnl >= 0 ? '+' : ''}${format(totals.pnl)}`, cls: pnlClass(totals.pnl) },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-1 text-lg font-bold ${item.cls ?? 'text-slate-900 dark:text-slate-50'}`}>{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable data={data} columns={columns} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} addLabel="Add Holding" searchKey="instrument" searchPlaceholder="Search..." />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? `Edit — ${editRow.instrument}` : 'Add Gold / Commodity'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <Field label="Name"           name="instrument"    required defaultValue={editRow?.instrument}  placeholder="Gold ETF" />
          <Field label="Type"           name="type"          required defaultValue={editRow?.type}        placeholder="ETF / Physical / Bond" />
          <Field label="Platform"       name="platform"      required defaultValue={editRow?.platform}    placeholder="Zerodha" />
          <Field label="Unit"           name="unit"          required defaultValue={editRow?.unit}        placeholder="grams / units" />
          <Field label="Quantity"       name="quantity"      type="number" step="0.001"  required value={qty}          onChange={setQty} />
          <Field label="Avg Cost"       name="avgCost"       type="number" step="0.01"   required value={avgCost}      onChange={setAvgCost} />
          <Field label="Invested"       name="purchaseAmount" type="number" step="0.01"  value={purchaseAmount.toFixed(2)} readOnly />
          <Field label="Current Price"  name="currentPrice"  type="number" step="0.01"   required value={currentPrice} onChange={setCurrentPrice} />
          <Field label="Current Amount" name="currentAmount" type="number" step="0.01"   value={currentAmount.toFixed(2)} readOnly />
        </FieldGrid>
      </EditModal>
    </AppShell>
  )
}
