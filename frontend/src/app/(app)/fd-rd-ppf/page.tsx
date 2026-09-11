'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { pnlClass, formatDate, daysRemaining } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { FixedDeposit } from '@/lib/types'

export default function FdRdPpfPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<FixedDeposit>('/api/fd-rd-ppf')

  const [editRow, setEditRow] = useState<FixedDeposit | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const columns: Column<FixedDeposit>[] = [
    { key: 'instrument',      label: 'Type',             className: 'font-semibold' },
    { key: 'accountNumber',   label: 'Account #',        className: 'font-mono text-xs' },
    { key: 'investmentAmount',label: 'Total Investment', render: (v) => format(Number(v)) },
    { key: 'currentAmount',   label: 'Current Value',    render: (v) => format(Number(v)) },
    {
      key: 'pnl',
      label: 'Gain',
      render: (_v, row) => {
        const gain = row.currentAmount - row.investmentAmount
        return <span className={pnlClass(gain)}>{gain >= 0 ? '+' : ''}{format(gain)}</span>
      },
    },
    { key: 'tenure',  label: 'Tenure' },
    { key: 'startDate', label: 'Start',   render: (v) => formatDate(String(v)) },
    { key: 'endDate',   label: 'Maturity',render: (v) => formatDate(String(v)) },
    {
      key: 'daysLeft',
      label: 'Days Left',
      render: (_v, row) => {
        const d = daysRemaining(row.endDate)
        return <Badge variant={d > 0 ? 'indigo' : 'amber'}>{d > 0 ? `${d}d` : 'Matured'}</Badge>
      },
    },
    { key: 'platform', label: 'Platform' },
    { key: 'notes', label: 'Notes', render: (v) => <span className="text-xs text-slate-400">{String(v ?? '')}</span> },
  ]

  const totalInvested = data.reduce((acc, h) => acc + h.investmentAmount, 0)
  const currentValue  = data.reduce((acc, h) => acc + h.currentAmount, 0)
  const pnl           = currentValue - totalInvested

  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:       fd.get('instrument') as string,
      accountNumber:    fd.get('accountNumber') as string,
      purchaseAmount:   parseFloat(fd.get('purchaseAmount') as string),
      investmentAmount: parseFloat(fd.get('investmentAmount') as string),
      currentAmount:    parseFloat(fd.get('currentAmount') as string),
      tenure:           fd.get('tenure') as string,
      platform:         fd.get('platform') as string,
      startDate:        new Date(fd.get('startDate') as string).toISOString(),
      endDate:          new Date(fd.get('endDate') as string).toISOString(),
      notes:            (fd.get('notes') as string) || null,
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
    <AppShell title="FD / RD / PPF" subtitle="Fixed deposits, recurring deposits, and PPF accounts">
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Invested',      value: format(totalInvested) },
          { label: 'Current Value', value: format(currentValue) },
          { label: 'P&L', value: `${pnl >= 0 ? '+' : ''}${format(pnl)}`, cls: pnlClass(pnl) },
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
          <Field label="Type"             name="instrument"      required defaultValue={editRow?.instrument}       placeholder="FD / RD / PPF" />
          <Field label="Account #"        name="accountNumber"   required defaultValue={editRow?.accountNumber} />
          <Field label="Purchase Amount"  name="purchaseAmount"  type="number" step="0.01" required defaultValue={editRow?.purchaseAmount} />
          <Field label="Total Investment" name="investmentAmount" type="number" step="0.01" required defaultValue={editRow?.investmentAmount} />
          <Field label="Current Amount"   name="currentAmount"   type="number" step="0.01" required defaultValue={editRow?.currentAmount} />
          <Field label="Tenure"           name="tenure"          required defaultValue={editRow?.tenure}           placeholder="Monthly / Yearly / One Time" />
          <Field label="Platform"         name="platform"        required defaultValue={editRow?.platform}         placeholder="SBI / HDFC" />
          <Field label="Start Date"       name="startDate"       type="date" required defaultValue={editRow ? editRow.startDate.slice(0, 10) : ''} />
          <Field label="End Date"         name="endDate"         type="date" required defaultValue={editRow ? editRow.endDate.slice(0, 10) : ''} />
          <div className="col-span-2"><Field label="Notes" name="notes" defaultValue={editRow?.notes ?? ''} /></div>
        </FieldGrid>
      </EditModal>
    </AppShell>
  )
}
