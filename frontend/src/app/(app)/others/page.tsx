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
import type { OtherInvestment } from '@/lib/types'

export default function OthersPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<OtherInvestment>('/api/others')

  const [editRow, setEditRow] = useState<OtherInvestment | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const columns: Column<OtherInvestment>[] = [
    { key: 'instrument',     label: 'Type',            className: 'font-semibold' },
    { key: 'brokerName',     label: 'Policy / Broker' },
    { key: 'annualPremium',  label: 'Annual Premium',  render: (v) => format(Number(v)) },
    { key: 'totalInvestment',label: 'Total Invested',  render: (v) => format(Number(v)) },
    { key: 'currentAmount',  label: 'Current Value',   render: (v) => format(Number(v)) },
    { key: 'sumAssured',     label: 'Sum Assured',     render: (v) => format(Number(v)) },
    { key: 'tenure',         label: 'Tenure' },
    { key: 'startDate',      label: 'Start',           render: (v) => formatDate(String(v)) },
    { key: 'endDate',        label: 'End',             render: (v) => formatDate(String(v)) },
    {
      key: 'daysLeft',
      label: 'Days Left',
      render: (_v, row) => {
        const d = daysRemaining(row.endDate)
        return <Badge variant={d > 0 ? 'indigo' : 'amber'}>{d > 0 ? `${d}d` : 'Matured'}</Badge>
      },
    },
    { key: 'notes', label: 'Notes', render: (v) => <span className="text-xs text-slate-400">{String(v ?? '')}</span> },
  ]

  const totalInvested = data.reduce((acc, h) => acc + h.totalInvestment, 0)
  const currentValue  = data.reduce((acc, h) => acc + h.currentAmount, 0)
  const pnl           = currentValue - totalInvested
  const closeModal    = () => { setEditRow(null); setIsAdding(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:      fd.get('instrument') as string,
      brokerName:      fd.get('brokerName') as string,
      accountNumber:   fd.get('accountNumber') as string,
      annualPremium:   parseFloat(fd.get('annualPremium') as string),
      totalInvestment: parseFloat(fd.get('totalInvestment') as string),
      currentAmount:   parseFloat(fd.get('currentAmount') as string),
      sumAssured:      parseFloat(fd.get('sumAssured') as string),
      tenure:          fd.get('tenure') as string,
      startDate:       new Date(fd.get('startDate') as string).toISOString(),
      endDate:         new Date(fd.get('endDate') as string).toISOString(),
      notes:           (fd.get('notes') as string) || null,
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
    <AppShell title="Others (LIC & Insurance)" subtitle="Life insurance and other long-term investments">
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
          <Field label="Type"                name="instrument"     required defaultValue={editRow?.instrument}     placeholder="LIC / NPS" />
          <Field label="Broker / Policy Name" name="brokerName"   required defaultValue={editRow?.brokerName} />
          <Field label="Account #"           name="accountNumber"  required defaultValue={editRow?.accountNumber} />
          <Field label="Annual Premium"      name="annualPremium"  type="number" step="0.01" required defaultValue={editRow?.annualPremium} />
          <Field label="Total Investment"    name="totalInvestment" type="number" step="0.01" required defaultValue={editRow?.totalInvestment} />
          <Field label="Current Amount"      name="currentAmount"  type="number" step="0.01" required defaultValue={editRow?.currentAmount} />
          <Field label="Sum Assured"         name="sumAssured"     type="number" step="0.01" required defaultValue={editRow?.sumAssured} />
          <Field label="Tenure"              name="tenure"         required defaultValue={editRow?.tenure}         placeholder="Yearly / One Time" />
          <Field label="Start Date"          name="startDate"      type="date" required defaultValue={editRow ? editRow.startDate.slice(0, 10) : ''} />
          <Field label="End Date"            name="endDate"        type="date" required defaultValue={editRow ? editRow.endDate.slice(0, 10) : ''} />
          <div className="col-span-2"><Field label="Notes" name="notes" defaultValue={editRow?.notes ?? ''} /></div>
        </FieldGrid>
      </EditModal>
    </AppShell>
  )
}
