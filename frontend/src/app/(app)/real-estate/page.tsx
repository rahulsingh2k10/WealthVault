'use client'

import { useState } from 'react'
import { CategoryBanner } from '@/components/ui/CategoryBanner'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatChangeRatio, pnlClass } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { RealEstateHolding } from '@/lib/types'

export default function RealEstatePage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<RealEstateHolding>('/api/real-estate')

  const [editRow, setEditRow] = useState<RealEstateHolding | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [purchaseVal, setPurchaseVal] = useState('')
  const [currentVal, setCurrentVal] = useState('')

  const purchaseAmount = parseFloat(purchaseVal) || 0
  const currentAmount  = parseFloat(currentVal) || 0

  const columns: Column<RealEstateHolding>[] = [
    { key: 'instrument',     label: 'Property',   className: 'max-w-xs truncate' },
    { key: 'type',           label: 'Type' },
    { key: 'purchaseAmount', label: 'Invested',   render: (v) => format(Number(v)) },
    { key: 'currentAmount',  label: 'Current',    render: (v) => format(Number(v)) },
    { key: 'pnl', label: 'P&L', render: (v) => <span className={pnlClass(Number(v))}>{Number(v) >= 0 ? '+' : ''}{format(Number(v))}</span> },
    { key: 'netChange', label: 'Return', render: (v) => <Badge variant={Number(v) >= 0 ? 'gain' : 'loss'}>{formatChangeRatio(Number(v))}</Badge> },
    { key: 'notes', label: 'Notes', render: (v) => v ? String(v) : '—' },
  ]

  const totals = data.reduce((acc, h) => ({ invested: acc.invested + h.purchaseAmount, current: acc.current + h.currentAmount, pnl: acc.pnl + h.pnl }), { invested: 0, current: 0, pnl: 0 })

  const openAdd    = () => { setEditRow(null); setPurchaseVal(''); setCurrentVal(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  const handleEdit = (row: RealEstateHolding) => {
    setEditRow(row)
    setPurchaseVal(String(row.purchaseAmount))
    setCurrentVal(String(row.currentAmount))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:    fd.get('instrument') as string,
      type:          fd.get('type') as string,
      purchaseAmount,
      currentAmount,
      pnl:           currentAmount - purchaseAmount,
      netChange:     purchaseAmount > 0 ? (currentAmount - purchaseAmount) / purchaseAmount : 0,
      notes:         fd.get('notes') as string || null,
    }
    if (editRow) { await update(editRow.id, fields) } else { await create(fields) }
    setSaving(false)
    closeModal()
  }

  return (
    <>
      <CategoryBanner slug="real-estate" />
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
        <DataTable data={data} columns={columns} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} addLabel="Add Property" searchKey="instrument" searchPlaceholder="Search property..." />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? `Edit — ${editRow.instrument}` : 'Add Property'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <div className="col-span-2"><Field label="Property Name" name="instrument" required defaultValue={editRow?.instrument} placeholder="2BHK Flat, Bandra West" /></div>
          <Field label="Type"            name="type"          required defaultValue={editRow?.type}        placeholder="Residential / Commercial / Land" />
          <Field label="Purchase Value"  name="purchaseAmount" type="number" step="1" required value={purchaseVal} onChange={setPurchaseVal} />
          <Field label="Current Value"   name="currentAmount"  type="number" step="1" required value={currentVal}  onChange={setCurrentVal} />
          <div className="col-span-2"><Field label="Notes" name="notes" defaultValue={editRow?.notes ?? ''} placeholder="Optional notes" /></div>
        </FieldGrid>
      </EditModal>
    </>
  )
}
