'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Card } from '@/components/ui/Card'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { BankAccount } from '@/lib/types'

export default function BankPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<BankAccount>('/api/bank')

  const [editRow, setEditRow] = useState<BankAccount | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const columns: Column<BankAccount>[] = [
    { key: 'bankName',      label: 'Bank',           className: 'font-semibold' },
    { key: 'ifscCode',      label: 'IFSC Code',      className: 'font-mono text-xs' },
    { key: 'accountNumber', label: 'Account Number', className: 'font-mono text-xs' },
    { key: 'balance', label: 'Balance', render: (v) => <span className="font-semibold text-emerald-500">{format(Number(v))}</span> },
  ]

  const totalBalance = data.reduce((acc, h) => acc + h.balance, 0)
  const closeModal   = () => { setEditRow(null); setIsAdding(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      bankName:      fd.get('bankName') as string,
      ifscCode:      fd.get('ifscCode') as string,
      accountNumber: fd.get('accountNumber') as string,
      balance:       parseFloat(fd.get('balance') as string),
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
    <AppShell title="Bank Accounts" subtitle="Savings and current account balances">
      <div className="mb-6 grid grid-cols-1 gap-4 max-w-xs">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Balance</p>
          <p className="mt-1 text-lg font-bold text-emerald-500">{format(totalBalance)}</p>
        </Card>
      </div>
      <Card>
        <DataTable data={data} columns={columns} loading={loading} onEdit={setEditRow} onDelete={(id) => remove(id)} onAdd={() => setIsAdding(true)} addLabel="Add Entry" />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? 'Edit Entry' : 'Add New Entry'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <Field label="Bank Name"      name="bankName"      required defaultValue={editRow?.bankName}      placeholder="HDFC Bank" />
          <Field label="IFSC Code"      name="ifscCode"      required defaultValue={editRow?.ifscCode}      placeholder="HDFC0000001" />
          <Field label="Account Number" name="accountNumber" required defaultValue={editRow?.accountNumber} />
          <Field label="Balance"        name="balance"       type="number" step="0.01" required defaultValue={editRow?.balance} />
        </FieldGrid>
      </EditModal>
    </AppShell>
  )
}
