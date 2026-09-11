'use client'

import { useState } from 'react'
import { CategoryBanner } from '@/components/ui/CategoryBanner'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Card } from '@/components/ui/Card'
import { StocksTable } from '@/components/ui/StocksTable'
import { pnlClass } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { StockHolding } from '@/lib/types'

export default function StocksPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<StockHolding>('/api/stocks')

  const [editRow, setEditRow] = useState<StockHolding | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicateError, setDuplicateError] = useState('')
  const [qty, setQty] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')

  const purchaseAmount = (parseFloat(qty) || 0) * (parseFloat(avgCost) || 0)
  const currentAmount  = (parseFloat(qty) || 0) * (parseFloat(currentPrice) || 0)

  const totals = data.reduce((acc, h) => ({ invested: acc.invested + h.purchaseAmount, current: acc.current + h.currentAmount, pnl: acc.pnl + h.pnl }), { invested: 0, current: 0, pnl: 0 })

  const openAdd    = () => { setEditRow(null); setQty(''); setAvgCost(''); setCurrentPrice(''); setDuplicateError(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false); setDuplicateError('') }

  const handleEdit = (row: StockHolding) => {
    setEditRow(row)
    setQty(String(row.quantity))
    setAvgCost(String(row.avgCost))
    setCurrentPrice(String(row.currentPrice))
    setDuplicateError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const name = fd.get('name') as string
    const instrument = fd.get('instrument') as string

    const isDuplicate = data.some(
      (item) => item.name?.toLowerCase() === name.toLowerCase() && item.instrument.toLowerCase() === instrument.toLowerCase() && item.id !== editRow?.id
    )
    if (isDuplicate) {
      setDuplicateError(`A stock with name "${name}" and symbol "${instrument}" already exists.`)
      setSaving(false)
      return
    }

    const fields = {
      name,
      instrument,
      quantity:      parseFloat(qty),
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
    <>
      <CategoryBanner slug="stocks" />
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Invested</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50" title={format(totals.invested)}>
            {format(totals.invested, true)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Current Value</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50" title={format(totals.current)}>
            {format(totals.current, true)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">P&L</p>
          <p className={`mt-1 text-lg font-bold ${pnlClass(totals.pnl)}`} title={`${totals.pnl >= 0 ? '+' : ''}${format(totals.pnl)}`}>
            {totals.pnl >= 0 ? '+' : ''}{format(totals.pnl, true)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Net Change</p>
          {totals.invested > 0 ? (
            <p className={`mt-1 text-lg font-bold ${pnlClass(totals.pnl)}`}>
              {totals.pnl >= 0 ? '+' : ''}{((totals.pnl / totals.invested) * 100).toFixed(2)}%
            </p>
          ) : (
            <p className="mt-1 text-lg font-bold text-slate-400">—</p>
          )}
        </Card>
      </div>
      <Card>
        <StocksTable data={data} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? `Edit — ${editRow.instrument}` : 'Add Stock'} onSubmit={handleSubmit} loading={saving}>
        {duplicateError && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{duplicateError}</p>
        )}
        <FieldGrid>
          <Field label="Name"              name="name"           required defaultValue={editRow?.name}       placeholder="Reliance Industries" />
          <Field label="Symbol"            name="instrument"     required defaultValue={editRow?.instrument}  placeholder="RELIANCE" />
          <Field label="Quantity"          name="quantity"       type="number" step="1"    required value={qty}          onChange={setQty} />
          <Field label="Avg. Price"        name="avgCost"        type="number" step="0.01" required value={avgCost}      onChange={setAvgCost} />
          <Field label="Invested Amount"   name="purchaseAmount" type="text"               value={purchaseAmount.toFixed(2)} readOnly />
          <Field label="Last Traded Value" name="currentPrice"   type="number" step="0.01" required value={currentPrice} onChange={setCurrentPrice} />
          <Field label="Current Amount"    name="currentAmount"  type="text"               value={currentAmount.toFixed(2)} readOnly />
          <Field label="Platform"          name="platform"       required defaultValue={editRow?.platform}   placeholder="Zerodha" />
        </FieldGrid>
      </EditModal>
    </>
  )
}
