'use client'

import { useState } from 'react'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatChangeRatio, pnlClass } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { NpsHolding } from '@/lib/types'

export default function NpsPage() {
  const { format, symbol } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<NpsHolding>('/api/nps')

  const [editRow, setEditRow] = useState<NpsHolding | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [purchasedUnits, setPurchasedUnits] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [currentUnits, setCurrentUnits] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')

  const purchaseAmount = (parseFloat(purchasedUnits) || 0) * (parseFloat(avgCost) || 0)
  const currentAmount  = (parseFloat(currentUnits) || 0) * (parseFloat(currentPrice) || 0)

  const columns: Column<NpsHolding>[] = [
    { key: 'instrument',     label: 'Scheme',         className: 'max-w-xs' },
    { key: 'folioNumber',    label: 'PRAN',            className: 'font-mono text-xs' },
    { key: 'purchasedUnits', label: 'Purchased Units', render: (v) => Number(v).toFixed(4) },
    { key: 'currentUnits',   label: 'Current Units',   render: (v) => Number(v).toFixed(4) },
    { key: 'avgCost',        label: 'Avg NAV',         render: (v) => `${symbol}${Number(v).toFixed(4)}` },
    { key: 'currentPrice',   label: 'Curr NAV',        render: (v) => `${symbol}${Number(v).toFixed(4)}` },
    { key: 'purchaseAmount', label: 'Invested',        render: (v) => format(Number(v)) },
    { key: 'currentAmount',  label: 'Current',         render: (v) => format(Number(v)) },
    { key: 'pnl', label: 'P&L', render: (v) => <span className={pnlClass(Number(v))}>{Number(v) >= 0 ? '+' : ''}{format(Number(v))}</span> },
    { key: 'netChange', label: 'Return', render: (v) => <Badge variant={Number(v) >= 0 ? 'gain' : 'loss'}>{formatChangeRatio(Number(v))}</Badge> },
  ]

  const totals = data.reduce((acc, h) => ({ invested: acc.invested + h.purchaseAmount, current: acc.current + h.currentAmount, pnl: acc.pnl + h.pnl }), { invested: 0, current: 0, pnl: 0 })

  const openAdd  = () => { setEditRow(null); setPurchasedUnits(''); setAvgCost(''); setCurrentUnits(''); setCurrentPrice(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  const handleEdit = (row: NpsHolding) => {
    setEditRow(row)
    setPurchasedUnits(String(row.purchasedUnits))
    setAvgCost(String(row.avgCost))
    setCurrentUnits(String(row.currentUnits))
    setCurrentPrice(String(row.currentPrice))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      folioNumber:    fd.get('folioNumber') as string,
      instrument:     fd.get('instrument') as string,
      purchasedUnits: parseFloat(purchasedUnits),
      avgCost:        parseFloat(avgCost),
      purchaseAmount,
      currentUnits:   parseFloat(currentUnits),
      currentPrice:   parseFloat(currentPrice),
      currentAmount,
      pnl:            currentAmount - purchaseAmount,
      netChange:      purchaseAmount > 0 ? (currentAmount - purchaseAmount) / purchaseAmount : 0,
      platform:       'NPS (CDSL)',
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
    <>
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Contributed', value: format(totals.invested) },
          { label: 'Current Value',     value: format(totals.current) },
          { label: 'P&L', value: `${totals.pnl >= 0 ? '+' : ''}${format(totals.pnl)}`, cls: pnlClass(totals.pnl) },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-1 text-lg font-bold ${item.cls ?? 'text-slate-900 dark:text-slate-50'}`}>{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable data={data} columns={columns} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} addLabel="Add Scheme" />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? 'Edit NPS Scheme' : 'Add NPS Scheme'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <Field label="PRAN / Folio"    name="folioNumber"    required defaultValue={editRow?.folioNumber} />
          <div className="col-span-2 col-start-1"><Field label="Scheme Name" name="instrument" required defaultValue={editRow?.instrument} /></div>
          <Field label="Purchased Units" name="purchasedUnits" type="number" step="0.0001" required value={purchasedUnits}  onChange={setPurchasedUnits} />
          <Field label="Avg NAV"         name="avgCost"        type="number" step="0.0001" required value={avgCost}         onChange={setAvgCost} />
          <Field label="Purchase Amount" name="purchaseAmount" type="number" step="0.01" value={purchaseAmount.toFixed(2)} readOnly />
          <Field label="Current Units"   name="currentUnits"   type="number" step="0.0001" required value={currentUnits}   onChange={setCurrentUnits} />
          <Field label="Current NAV"     name="currentPrice"   type="number" step="0.0001" required value={currentPrice}   onChange={setCurrentPrice} />
          <Field label="Current Amount"  name="currentAmount"  type="number" step="0.01" value={currentAmount.toFixed(2)} readOnly />
        </FieldGrid>
      </EditModal>
    </>
  )
}
