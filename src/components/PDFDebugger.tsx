// components/PDFDebugger.tsx
'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Upload, FileText, Eye, Bug } from 'lucide-react'

interface DebugResult {
  success: boolean
  message: string
  debug?: {
    pagesProcessed: number
    parsingMethod: string
    pageStats?: Array<{
      pageNumber: number
      length: number
      lines: number
      sample: string
    }>
    searchPatterns?: {
      datePatterns: number
      amountPatterns: number
      dollarSigns: number
    }
    sampleTransactions?: Array<{
      date: string
      amount: number
      raw_merchant: string
    }>
  }
  error?: string
  details?: string
}

export default function PDFDebugger() {
  const [isUploading, setIsUploading] = useState(false)
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showFullDebug, setShowFullDebug] = useState(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setDebugResult(null)
    } else {
      alert('Please select a PDF file')
    }
  }

  const handleDebugUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setDebugResult(null)

    try {
      const formData = new FormData()
      formData.append('pdf', selectedFile)

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      setDebugResult(result)
      
    } catch (error) {
      setDebugResult({
        success: false,
        message: 'Network error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            PDF Debug Tool
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload your PDF to see detailed parsing information and debug any issues
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFile && (
              <p className="text-sm text-gray-600">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <Button 
            onClick={handleDebugUpload} 
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white mr-2" />
                Debugging...
              </>
            ) : (
              <>
                <Bug className="h-4 w-4 mr-2" />
                Debug PDF Processing
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {debugResult && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Debug Results
              </span>
              <Badge variant={debugResult.success ? "default" : "destructive"}>
                {debugResult.success ? "Success" : "Failed"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-md bg-gray-50">
              <p className="font-medium text-sm">{debugResult.message}</p>
              {debugResult.error && (
                <p className="text-red-600 text-sm mt-1">Error: {debugResult.error}</p>
              )}
              {debugResult.details && (
                <p className="text-gray-600 text-sm mt-1">Details: {debugResult.details}</p>
              )}
            </div>

            {debugResult.debug && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium">Pages Processed</p>
                    <p className="text-2xl font-bold">{debugResult.debug.pagesProcessed}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-sm font-medium">Parsing Method</p>
                    <p className="text-sm">{debugResult.debug.parsingMethod}</p>
                  </div>
                  {debugResult.debug.searchPatterns && (
                    <>
                      <div className="p-3 border rounded-lg">
                        <p className="text-sm font-medium">Date Patterns</p>
                        <p className="text-2xl font-bold">{debugResult.debug.searchPatterns.datePatterns}</p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="text-sm font-medium">Amount Patterns</p>
                        <p className="text-2xl font-bold">{debugResult.debug.searchPatterns.amountPatterns}</p>
                      </div>
                    </>
                  )}
                </div>

                {debugResult.debug.sampleTransactions && debugResult.debug.sampleTransactions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Sample Transactions Found:</h4>
                    <div className="space-y-2">
                      {debugResult.debug.sampleTransactions.map((tx, index) => (
                        <div key={index} className="p-2 border rounded bg-green-50">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{tx.raw_merchant}</span>
                            <span className="font-bold">${tx.amount}</span>
                          </div>
                          <p className="text-sm text-gray-600">{tx.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {debugResult.debug.pageStats && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">Page Analysis:</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFullDebug(!showFullDebug)}
                      >
                        {showFullDebug ? 'Hide' : 'Show'} Details
                      </Button>
                    </div>
                    
                    {showFullDebug && (
                      <div className="space-y-3">
                        {debugResult.debug.pageStats.map((page, index) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium">Page {page.pageNumber}</h5>
                              <div className="text-sm text-gray-600">
                                {page.length} chars, {page.lines} lines
                              </div>
                            </div>
                            <div className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">
                              <pre>{page.sample}</pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}