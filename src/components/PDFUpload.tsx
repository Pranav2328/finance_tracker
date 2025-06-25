// components/PDFUpload.tsx
'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface UploadResult {
  success: boolean
  message: string
  transactionCount?: number
}

export default function PDFUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setUploadResult(null)
    } else {
      alert('Please select a PDF file')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('pdf', selectedFile)

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadResult({
          success: true,
          message: `Successfully processed ${result.transactionCount} transactions`,
          transactionCount: result.transactionCount
        })
        onUploadComplete()
      } else {
        setUploadResult({
          success: false,
          message: result.error || 'Upload failed'
        })
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Network error occurred'
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload Bank of America Statement
        </CardTitle>
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
              Selected: {selectedFile.name}
            </p>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload & Process
            </>
          )}
        </Button>

        {uploadResult && (
          <div className={`flex items-start gap-2 p-3 rounded-md ${
            uploadResult.success 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {uploadResult.success ? (
              <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">{uploadResult.message}</p>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Upload your BofA credit card statement PDF</p>
          <p>• Transactions will be automatically parsed and classified</p>
          <p>• Review and edit merchant names as needed</p>
        </div>
      </CardContent>
    </Card>
  )
}