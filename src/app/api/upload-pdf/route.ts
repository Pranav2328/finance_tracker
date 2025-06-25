// app/api/upload-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { extractPDFText } from '@/lib/pdf-parser'
import { parseBofAStatement } from '@/lib/bofa-parser'

// Transaction parser for BofA format based on your actual PDF structure
function parseTransactions(text: string): Array<{date: string, amount: number, rawMerchant: string, description: string}> {
  const lines = text.split('\n')
  const transactions: Array<{date: string, amount: number, rawMerchant: string, description: string}> = []
  
  console.log('Parsing lines, total:', lines.length)
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Skip empty lines
    if (!trimmedLine) continue
    
    // BofA format from your PDF: MM/DD MM/DD MERCHANT_DESCRIPTION REFERENCE ACCOUNT AMOUNT
    // First check if line starts with date pattern
    if (!/^\d{2}\/\d{2}/.test(trimmedLine)) continue
    
    // Split the line into parts
    const parts = trimmedLine.split(/\s+/)
    
    // Need at least 6 parts: date1, date2, description..., ref, account, amount
    if (parts.length < 6) continue
    
    // Extract the components
    const dateStr = parts[0]  // MM/DD
    const postDate = parts[1]  // MM/DD
    
    // Amount is the last part
    const amountStr = parts[parts.length - 1]
    
    // Check if amount is valid
    if (!/^[-]?\d+[,]?\d*\.\d{2}$/.test(amountStr)) continue
    
    // Account and reference are the two parts before amount
    const accountNum = parts[parts.length - 2]
    const refNum = parts[parts.length - 3]
    
    // Check if they look like numbers
    if (!/^\d+$/.test(accountNum) || !/^\d+$/.test(refNum)) continue
    
    // Everything between postDate and refNum is the merchant description
    const merchantParts = parts.slice(2, parts.length - 3)
    const merchantDesc = merchantParts.join(' ')
    
    // Skip if it looks like a header
    if (merchantDesc.toLowerCase().includes('description') || 
        merchantDesc.toLowerCase().includes('reference') ||
        merchantDesc.toLowerCase().includes('total')) {
      continue
    }
    
    // Parse the date - assuming 2025 based on statement
    const [month, day] = dateStr.split('/')
    const parsedDate = new Date(2025, parseInt(month) - 1, parseInt(day))
    const isoDate = parsedDate.toISOString().split('T')[0]
    
    const transaction = {
      date: isoDate,
      amount: parseFloat(amountStr.replace(/,/g, '')),
      rawMerchant: merchantDesc,
      description: trimmedLine
    }
    
    transactions.push(transaction)
    console.log('Found transaction:', transaction)
  }
  
  console.log(`Total transactions found: ${transactions.length}`)
  return transactions
}

// Enhanced merchant classifier
function classifyMerchant(rawMerchant: string): {cleanName: string, category?: string} {
  const upperRaw = rawMerchant.toUpperCase()
  
  // Transportation
  if (upperRaw.includes('MBTA')) return {cleanName: 'MBTA', category: 'Transportation'}
  if (upperRaw.includes('UBER')) return {cleanName: 'Uber', category: 'Transportation'}
  if (upperRaw.includes('LYFT')) return {cleanName: 'Lyft', category: 'Transportation'}
  if (upperRaw.includes('ZIPCAR')) return {cleanName: 'Zipcar', category: 'Transportation'}
  
  // Food & Dining
  if (upperRaw.includes('STARBUCKS')) return {cleanName: 'Starbucks', category: 'Coffee'}
  if (upperRaw.includes('DUNKIN')) return {cleanName: 'Dunkin', category: 'Coffee'}
  if (upperRaw.includes('DOORDASH')) return {cleanName: 'DoorDash', category: 'Food Delivery'}
  if (upperRaw.includes('TATTE BAKERY')) return {cleanName: 'Tatte Bakery', category: 'Coffee'}
  if (upperRaw.includes('NEW SAIGON')) return {cleanName: 'New Saigon Restaurant', category: 'Restaurant'}
  if (upperRaw.includes('JIANG NAN')) return {cleanName: 'Jiang Nan', category: 'Restaurant'}
  if (upperRaw.includes('SWEETGREEN')) return {cleanName: 'Sweetgreen', category: 'Restaurant'}
  
  // Shopping
  if (upperRaw.includes('TARGET')) return {cleanName: 'Target', category: 'Shopping'}
  if (upperRaw.includes('STOP & SHOP')) return {cleanName: 'Stop & Shop', category: 'Groceries'}
  if (upperRaw.includes('WALGREENS')) return {cleanName: 'Walgreens', category: 'Pharmacy'}
  if (upperRaw.includes('CVS')) return {cleanName: 'CVS', category: 'Pharmacy'}
  
  // Entertainment & Services
  if (upperRaw.includes('SPOTIFY')) return {cleanName: 'Spotify', category: 'Entertainment'}
  if (upperRaw.includes('PARAMOUNT')) return {cleanName: 'Paramount+', category: 'Entertainment'}
  if (upperRaw.includes('CLAUDE.AI')) return {cleanName: 'Claude AI', category: 'Software'}
  if (upperRaw.includes('ONLYFANS')) return {cleanName: 'OnlyFans', category: 'Entertainment'}
  if (upperRaw.includes('NBA LEAGUE PASS')) return {cleanName: 'NBA League Pass', category: 'Entertainment'}
  
  // Default cleanup
  let cleanName = rawMerchant
    .replace(/^TST\*\s*/, '')
    .replace(/^DD \*/, '')
    .replace(/^SQ \*/, '')
    .replace(/\s+\d{3}-\d{3}-?\d{4}/, '') // Remove phone numbers
    .replace(/\s+\d{4}\s+\d{4}$/, '') // Remove trailing numbers
    .replace(/\s+[A-Z]{2}$/, '') // Remove state codes at end
    .trim()
  
  return {cleanName}
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== PDF Upload API called ===')
    
    const formData = await request.formData()
    const file = formData.get('pdf') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}`)

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      console.log('Attempting to extract text from PDF...')
      
      // Extract text pages from PDF
      const pages = await extractPDFText(buffer)
      console.log(`Extracted ${pages.length} pages from PDF`)
      
      // Try BofA parser first
      const { transactions: bofaTransactions } = parseBofAStatement(pages)
      
      let transactionsToProcess;
      if (bofaTransactions.length > 0) {
        console.log(`BofA parser found ${bofaTransactions.length} transactions`)
        
        // Convert BofA transactions to our format
        transactionsToProcess = bofaTransactions.map(tx => {
          // Parse date - BofA uses MM/DD format, assuming 2025 based on statement
          const [month, day] = tx.transactionDate.split('/')
          const txDate = new Date(2025, parseInt(month) - 1, parseInt(day))
          
          return {
            date: txDate.toISOString().split('T')[0],
            amount: Math.abs(tx.amount), // Store as positive
            rawMerchant: tx.description,
            description: tx.description
          }
        })
      } else {
        // Fallback to simple parser
        console.log('Using simple parser...')
        const allText = pages.join('\n')
        transactionsToProcess = parseTransactions(allText)
      }
      
      if (transactionsToProcess.length === 0) {
        // Log more debug info to help troubleshoot
        console.log('=== Debug Info ===')
        console.log('Total pages:', pages.length)
        console.log('First page sample:', pages[0]?.substring(0, 1000))
        console.log('All text sample:', pages.join('\n').substring(0, 2000))
        
        return NextResponse.json({
          error: 'No transactions found in PDF',
          debug: {
            pagesExtracted: pages.length,
            firstPageSample: pages[0]?.substring(0, 500),
            textLength: pages.join('').length
          }
        }, { status: 400 })
      }
      
      // Process and classify transactions
      const processedTransactions = transactionsToProcess.map(transaction => {
        const classification = classifyMerchant(transaction.rawMerchant)
        
        return {
          date: transaction.date,
          amount: transaction.amount,
          raw_merchant: transaction.rawMerchant,
          clean_merchant: classification.cleanName,
          category: classification.category
        }
      })
      
      console.log(`Processed ${processedTransactions.length} transactions`)
      console.log('Sample transaction:', processedTransactions[0])
      
      // Save to database
      const { data, error } = await supabase
        .from('transactions')
        .insert(processedTransactions)
        .select()
      
      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({
          error: 'Failed to save transactions to database',
          details: error.message
        }, { status: 500 })
      }
      
      console.log(`Successfully saved ${data?.length} transactions to database`)
      
      return NextResponse.json({
        success: true,
        transactionCount: processedTransactions.length,
        message: `Successfully processed ${processedTransactions.length} transactions from ${file.name}`,
        transactions: data
      })
      
    } catch (error) {
      console.error('Processing error:', error)
      return NextResponse.json({
        error: 'Failed to process PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}