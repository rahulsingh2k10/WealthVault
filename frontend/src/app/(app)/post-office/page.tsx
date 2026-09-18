'use client'

import { useState } from 'react'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { pnlClass, formatDate, daysRemaining } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { PostOfficeScheme } from '@/lib/types'

export default function PostOfficePage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<PostOfficeScheme>('/api/post-office')

  const [editRow, setEditRow] = useState<PostOfficeScheme | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const columns: Column<PostOfficeScheme>[] = [
    { key: 'instrument',    label: 'Scheme',       className: 'font-semibold' },
    { key: 'accountNumber', label: 'Account #',    className: 'font-mono text-xs' },
    { key: 'purchaseAmount',label: 'Invested',     render: (v) => format(Number(v)) },
    { key: 'maturityAmount',label: 'Maturity',     render: (v) => format(Number(v)) },
    {
      key: 'pnl',
      label: 'Expected Gain',
      render: (_v, row) => {
        const gain = row.maturityAmount - row.purchaseAmount
        return <span className={pnlClass(gain)}>{gain >= 0 ? '+' : ''}{format(gain)}</span>
      },
    },
    { key: 'tenure',   label: 'Tenure' },
    { key: 'startDate',label: 'Start',        render: (v) => formatDate(String(v)) },
    { key: 'endDate',  label: 'Maturity Date', render: (v) => formatDate(String(v)) },
    {
      key: 'daysLeft',
      label: 'Days Left',
      render: (_v, row) => {
        const d = daysRemaining(row.endDate)
        return <Badge variant={d > 0 ? 'indigo' : 'amber'}>{d > 0 ? `${d}d` : 'Matured'}</Badge>
      },
    },
    { key: 'platform', label: 'Platform' },
  ]

  const totalInvested = data.reduce((acc, h) => acc + h.purchaseAmount, 0)
  const currentValue  = data.reduce((acc, h) => acc + h.maturityAmount, 0)
  const pnl           = currentValue - totalInvested

  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:     fd.get('instrument') as string,
      accountNumber:  fd.get('accountNumber') as string,
      purchaseAmount: parseFloat(fd.get('purchaseAmount') as string),
      maturityAmount: parseFloat(fd.get('maturityAmount') as string),
      tenure:         fd.get('tenure') as string,
      platform:       fd.get('platform') as string,
      startDate:      new Date(fd.get('startDate') as string).toISOString(),
      endDate:        new Date(fd.get('endDate') as string).toISOString(),
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
          { label: 'Invested',       value: format(totalInvested) },
          { label: 'Maturity Value', value: format(currentValue) },
          { label: 'Expected Gain',  value: `${pnl >= 0 ? '+' : ''}${format(pnl)}`, cls: pnlClass(pnl) },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-1 text-lg font-bold ${item.cls ?? 'text-slate-900 dark:text-slate-50'}`}>{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable data={data} columns={columns} loading={loading} onEdit={setEditRow} onDelete={(id) => remove(id)} onAdd={() => setIsAdding(true)} addLabel="Add Entry" />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? 'Edit Entry' : 'Add New Entry'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <Field label="Scheme"         name="instrument"    required defaultValue={editRow?.instrument}    placeholder="KVP / NSC" />
          <Field label="Account Number" name="accountNumber" required defaultValue={editRow?.accountNumber} />
          <Field label="Invested"       name="purchaseAmount" type="number" step="0.01" required defaultValue={editRow?.purchaseAmount} />
          <Field label="Maturity Amount"name="maturityAmount" type="number" step="0.01" required defaultValue={editRow?.maturityAmount} />
          <Field label="Tenure"         name="tenure"        required defaultValue={editRow?.tenure}        placeholder="One Time / Monthly" />
          <Field label="Platform"       name="platform"      required defaultValue={editRow?.platform} />
          <Field label="Start Date"     name="startDate"     type="date" required defaultValue={editRow ? editRow.startDate.slice(0, 10) : ''} />
          <Field label="End Date"       name="endDate"       type="date" required defaultValue={editRow ? editRow.endDate.slice(0, 10) : ''} />
        </FieldGrid>
      </EditModal>
    </>
  )
}
