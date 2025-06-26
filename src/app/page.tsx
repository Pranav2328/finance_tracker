// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PDFUpload from '@/components/PDFUpload'
import PDFDebugger from '@/components/PDFDebugger'
import { supabase, Transaction } from '@/lib/supabase'
import { DollarSign, TrendingUp, Calendar, Trash2, Bug, Upload } from 'lucide-react'

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSpent, setTotalSpent] = useState(0)
  const [currentMonth, setCurrentMonth] = useState('')
  const [showDebugMode, setShowDebugMode] = useState(false)

  useEffect(() => {
    fetchTransactions()
    setCurrentMonth(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
  }, [])

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error

      setTransactions(data || [])
      
      // Calculate total spent
      const total = (data || []).reduce((sum, transaction) => sum + transaction.amount, 0)
      setTotalSpent(total)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Refresh transactions
      fetchTransactions()
    } catch (error) {
      console.error('Error deleting transaction:', error)
    }
  }

  const clearAllTransactions = async () => {
    if (confirm('Are you sure you want to delete all transactions? This cannot be undone.')) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

        if (error) throw error
        fetchTransactions()
      } catch (error) {
        console.error('Error clearing transactions:', error)
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Expense Tracker</h1>
        <p className="text-gray-600">Track your Bank of America expenses</p>
        
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant={showDebugMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowDebugMode(!showDebugMode)}
          >
            <Bug className="h-4 w-4 mr-2" />
            {showDebugMode ? 'Hide' : 'Show'} Debug Mode
          </Button>
          {transactions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={clearAllTransactions}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upload/Debug Section */}
      {showDebugMode ? (
        <PDFDebugger />
      ) : (
        <PDFUpload onUploadComplete={fetchTransactions} />
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No transactions yet</p>
              <p className="text-sm">Upload a Bank of America PDF statement to get started!</p>
              {showDebugMode && (
                <p className="text-xs text-blue-600 mt-2">
                  Use Debug Mode above to troubleshoot PDF parsing issues
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{transaction.clean_merchant || transaction.raw_merchant}</span>
                      {transaction.category && (
                        <Badge variant="secondary" className="text-xs">
                          {transaction.category}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {formatDate(transaction.date)} • {transaction.raw_merchant}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">
                      {formatCurrency(transaction.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTransaction(transaction.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Info */}
      {showDebugMode && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Debug Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">Total Transactions</p>
                  <p className="text-2xl font-bold">{transactions.length}</p>
                </div>
                <div>
                  <p className="font-medium">Categories Found</p>
                  <p className="text-2xl font-bold">
                    {new Set(transactions.map(t => t.category).filter(Boolean)).size}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Date Range</p>
                  <p className="text-sm">
                    {transactions.length > 0 && 
                      `${formatDate(transactions[transactions.length - 1].date)} - ${formatDate(transactions[0].date)}`
                    }
                  </p>
                </div>
                <div>
                  <p className="font-medium">Avg Amount</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(totalSpent / transactions.length || 0)}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="font-medium mb-2">Categories Breakdown:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(transactions.map(t => t.category).filter(Boolean))).map(category => (
                    <Badge key={category} variant="outline">
                      {category} ({transactions.filter(t => t.category === category).length})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}