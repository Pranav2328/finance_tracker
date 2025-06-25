// components/ManualEntry.tsx
'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Plus, Save } from 'lucide-react'

interface Transaction {
  date: string
  amount: number
  merchant: string
  category?: string
}

export default function ManualEntry({ onSave }: { onSave: (transactions: Transaction[]) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([
    { date: '', amount: 0, merchant: '', category: '' }
  ])

  const addTransaction = () => {
    setTransactions([...transactions, { date: '', amount: 0, merchant: '', category: '' }])
  }

  const updateTransaction = (index: number, field: keyof Transaction, value: string | number) => {
    const updated = transactions.map((t, i) => 
      i === index ? { ...t, [field]: value } : t
    )
    setTransactions(updated)
  }

  const removeTransaction = (index: number) => {
    setTransactions(transactions.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    const validTransactions = transactions.filter(t => 
      t.date && t.amount > 0 && t.merchant.trim()
    )
    onSave(validTransactions)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Manual Transaction Entry
        </CardTitle>
        <p className="text-sm text-gray-600">
          Enter your Bank of America transactions manually while we fix the PDF parsing
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.map((transaction, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-lg">
            <Input
              type="date"
              placeholder="Date"
              value={transaction.date}
              onChange={(e) => updateTransaction(index, 'date', e.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={transaction.amount || ''}
              onChange={(e) => updateTransaction(index, 'amount', parseFloat(e.target.value) || 0)}
            />
            <Input
              placeholder="Merchant"
              value={transaction.merchant}
              onChange={(e) => updateTransaction(index, 'merchant', e.target.value)}
            />
            <Input
              placeholder="Category (optional)"
              value={transaction.category || ''}
              onChange={(e) => updateTransaction(index, 'category', e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeTransaction(index)}
              disabled={transactions.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={addTransaction}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Transactions
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}