// app/api/upload-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { extractPDFText } from '@/lib/pdf-parser'
import { parseBofAStatement } from '@/lib/bofa-parser'

// Enhanced transaction parser that tries multiple approaches
function parseTransactionsMultiple(pages: string[]): Array<{date: string, amount: number, rawMerchant: string, description: string}> {
  console.log('=== Starting multi-approach transaction parsing ===');
  
  const allText = pages.join('\n');
  const lines = allText.split('\n').map(l => l.trim()).filter(l => l);
  
  console.log(`Total lines to analyze: ${lines.length}`);
  
  // Sample some lines for debugging
  console.log('=== Sample lines for debugging ===');
  lines.slice(0, 20).forEach((line, i) => {
    console.log(`Line ${i + 1}: "${line}"`);
  });
  
  const transactions: Array<{date: string, amount: number, rawMerchant: string, description: string}> = [];
  
  // Approach 1: Look for date patterns with amounts
  console.log('--- Approach 1: Date + Amount patterns ---');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip obviously non-transaction lines
    if (line.length < 8) continue;
    if (line.match(/(total|balance|interest|fee|page|continued)/i)) continue;
    
    // Look for various date patterns followed by amounts
    const patterns = [
      // MM/DD description amount
      /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})$/,
      // MM/DD/YY description amount
      /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})$/,
      // MM/DD MM/DD description amount (BofA format)
      /^(\d{1,2}\/\d{1,2})\s+\d{1,2}\/\d{1,2}\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})$/,
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, dateStr, description, amountStr] = match;
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        
        if (amount > 0 && description.length > 2) {
          // Parse date - add year if missing
          let parsedDate: string;
          if (dateStr.includes('/') && dateStr.split('/').length === 2) {
            // Assume current year for MM/DD format
            parsedDate = `2025-${dateStr.split('/')[0].padStart(2, '0')}-${dateStr.split('/')[1].padStart(2, '0')}`;
          } else {
            // Try to parse full date
            const dateParts = dateStr.split('/');
            if (dateParts.length === 3) {
              let year = parseInt(dateParts[2]);
              if (year < 50) year += 2000;
              else if (year < 100) year += 1900;
              parsedDate = `${year}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
            } else {
              parsedDate = '2025-01-01'; // Fallback
            }
          }
          
          const transaction = {
            date: parsedDate,
            amount: amount,
            rawMerchant: description.trim(),
            description: line
          };
          
          transactions.push(transaction);
          console.log(`Found transaction (approach 1): ${transaction.rawMerchant} - $${transaction.amount}`);
        }
        break;
      }
    }
  }
  
  // Approach 2: Look for any line with amount patterns
  if (transactions.length === 0) {
    console.log('--- Approach 2: Any line with amounts ---');
    
    for (const line of lines) {
      if (line.length < 10) continue;
      
      // Look for dollar amounts anywhere in the line
      const amountMatches = line.match(/\$?(\d{1,3}(?:,\d{3})*\.\d{2})/g);
      const dateMatches = line.match(/\b(\d{1,2}\/\d{1,2})\b/g);
      
      if (amountMatches && dateMatches && !line.match(/(total|balance|page)/i)) {
        const amount = parseFloat(amountMatches[0].replace(/[$,]/g, ''));
        const dateStr = dateMatches[0];
        
        if (amount > 0) {
          let description = line
            .replace(/\$?\d{1,3}(?:,\d{3})*\.\d{2}/g, '') // Remove amounts
            .replace(/\b\d{1,2}\/\d{1,2}\b/g, '') // Remove dates
            .trim();
          
          if (description.length > 2) {
            const parsedDate = `2025-${dateStr.split('/')[0].padStart(2, '0')}-${dateStr.split('/')[1].padStart(2, '0')}`;
            
            transactions.push({
              date: parsedDate,
              amount: amount,
              rawMerchant: description,
              description: line
            });
            
            console.log(`Found transaction (approach 2): ${description} - $${amount}`);
          }
        }
      }
    }
  }
  
  // Approach 3: Manual patterns for common formats
  if (transactions.length === 0) {
    console.log('--- Approach 3: Manual pattern matching ---');
    
    for (const line of lines) {
      // Look for merchant names followed by amounts
      const manualPatterns = [
        /(\w+.*?)(\d{1,3}(?:,\d{3})*\.\d{2})/,
      ];
      
      for (const pattern of manualPatterns) {
        const match = line.match(pattern);
        if (match && !line.match(/(total|balance|date|amount)/i)) {
          const [, merchant, amountStr] = match;
          const amount = parseFloat(amountStr.replace(/,/g, ''));
          
          if (amount > 0 && merchant.trim().length > 2) {
            transactions.push({
              date: '2025-01-01', // Default date
              amount: amount,
              rawMerchant: merchant.trim(),
              description: line
            });
            
            console.log(`Found transaction (approach 3): ${merchant.trim()} - $${amount}`);
          }
          break;
        }
      }
    }
  }
  
  console.log(`=== Total transactions found: ${transactions.length} ===`);
  return transactions;
}

// Enhanced merchant classifier with more patterns
function classifyMerchant(rawMerchant: string): {cleanName: string, category?: string} {
  const upperRaw = rawMerchant.toUpperCase();
  
  // Transportation
  if (upperRaw.includes('MBTA')) return {cleanName: 'MBTA', category: 'Transportation'};
  if (upperRaw.includes('UBER')) return {cleanName: 'Uber', category: 'Transportation'};
  if (upperRaw.includes('LYFT')) return {cleanName: 'Lyft', category: 'Transportation'};
  if (upperRaw.includes('ZIPCAR')) return {cleanName: 'Zipcar', category: 'Transportation'};
  
  // Food & Dining
  if (upperRaw.includes('STARBUCKS')) return {cleanName: 'Starbucks', category: 'Coffee'};
  if (upperRaw.includes('DUNKIN')) return {cleanName: 'Dunkin', category: 'Coffee'};
  if (upperRaw.includes('DOORDASH')) return {cleanName: 'DoorDash', category: 'Food Delivery'};
  if (upperRaw.includes('TATTE')) return {cleanName: 'Tatte Bakery', category: 'Coffee'};
  if (upperRaw.includes('SAIGON')) return {cleanName: 'New Saigon Restaurant', category: 'Restaurant'};
  if (upperRaw.includes('SWEETGREEN')) return {cleanName: 'Sweetgreen', category: 'Restaurant'};
  
  // Shopping
  if (upperRaw.includes('TARGET')) return {cleanName: 'Target', category: 'Shopping'};
  if (upperRaw.includes('STOP') && upperRaw.includes('SHOP')) return {cleanName: 'Stop & Shop', category: 'Groceries'};
  if (upperRaw.includes('WALGREENS')) return {cleanName: 'Walgreens', category: 'Pharmacy'};
  if (upperRaw.includes('CVS')) return {cleanName: 'CVS', category: 'Pharmacy'};
  
  // Entertainment & Services
  if (upperRaw.includes('SPOTIFY')) return {cleanName: 'Spotify', category: 'Entertainment'};
  if (upperRaw.includes('NETFLIX')) return {cleanName: 'Netflix', category: 'Entertainment'};
  if (upperRaw.includes('AMAZON')) return {cleanName: 'Amazon', category: 'Shopping'};
  
  // Clean up the merchant name
  let cleanName = rawMerchant
    .replace(/^(TST\*|DD\*|SQ\*)\s*/i, '') // Remove common prefixes
    .replace(/\s*\d{3}-?\d{3}-?\d{4}\s*/g, ' ') // Remove phone numbers
    .replace(/\s*\d{4,}\s*/g, ' ') // Remove long numbers
    .replace(/\s*[A-Z]{2}\s*$/i, '') // Remove state codes at end
    .replace(/\s+/g, ' ')
    .trim();
  
  // Convert to title case
  cleanName = cleanName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  
  return {cleanName};
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== PDF Upload API called ===');
    
    const formData = await request.formData();
    const file = formData.get('pdf') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log('Attempting to extract text from PDF...');
      
      // Extract text pages from PDF
      const pages = await extractPDFText(buffer);
      console.log(`Extracted ${pages.length} pages from PDF`);
      
      if (pages.length === 0) {
        return NextResponse.json({
          error: 'No pages could be extracted from PDF',
          debug: { fileSize: file.size, fileName: file.name }
        }, { status: 400 });
      }
      
      // Try BofA parser first
      console.log('Trying BofA parser...');
      const { transactions: bofaTransactions } = parseBofAStatement(pages);
      
      let transactionsToProcess;
      if (bofaTransactions.length > 0) {
        console.log(`BofA parser found ${bofaTransactions.length} transactions`);
        
        // Convert BofA transactions to our format
        transactionsToProcess = bofaTransactions.map(tx => {
          // Parse date - BofA uses MM/DD format, assuming 2025
          const [month, day] = tx.transactionDate.split('/');
          const txDate = new Date(2025, parseInt(month) - 1, parseInt(day));
          
          return {
            date: txDate.toISOString().split('T')[0],
            amount: Math.abs(tx.amount),
            rawMerchant: tx.description,
            description: tx.description
          };
        });
      } else {
        // Use enhanced multi-approach parser
        console.log('Using enhanced multi-approach parser...');
        transactionsToProcess = parseTransactionsMultiple(pages);
      }
      
      if (transactionsToProcess.length === 0) {
        // Return detailed debug info
        console.log('=== No transactions found - Debug Info ===');
        
        const debugInfo = {
          pagesExtracted: pages.length,
          totalTextLength: pages.join('').length,
          pageStats: pages.map((page, i) => ({
            pageNumber: i + 1,
            length: page.length,
            lines: page.split('\n').length,
            sample: page.substring(0, 300)
          })),
          searchPatterns: {
            datePatterns: pages.join('\n').match(/\d{1,2}\/\d{1,2}/g)?.length || 0,
            amountPatterns: pages.join('\n').match(/\d{1,3}(?:,\d{3})*\.\d{2}/g)?.length || 0,
            dollarSigns: pages.join('\n').match(/\$/g)?.length || 0
          }
        };
        
        return NextResponse.json({
          error: 'No transactions found in PDF. This might be a different format than expected.',
          debug: debugInfo
        }, { status: 400 });
      }
      
      // Process and classify transactions
      const processedTransactions = transactionsToProcess.map(transaction => {
        const classification = classifyMerchant(transaction.rawMerchant);
        
        return {
          date: transaction.date,
          amount: transaction.amount,
          raw_merchant: transaction.rawMerchant,
          clean_merchant: classification.cleanName,
          category: classification.category,
          description: transaction.description
        };
      });
      
      console.log(`Processed ${processedTransactions.length} transactions for database`);
      
      // Save to database
      const { data, error } = await supabase
        .from('transactions')
        .insert(processedTransactions)
        .select();
      
      if (error) {
        console.error('Database error:', error);
        return NextResponse.json({
          error: 'Failed to save transactions to database',
          details: error.message
        }, { status: 500 });
      }
      
      console.log(`Successfully saved ${data?.length} transactions to database`);
      
      return NextResponse.json({
        success: true,
        transactionCount: processedTransactions.length,
        message: `Successfully processed ${processedTransactions.length} transactions from ${file.name}`,
        transactions: data,
        debug: {
          pagesProcessed: pages.length,
          parsingMethod: bofaTransactions.length > 0 ? 'BofA Parser' : 'Enhanced Multi-Approach Parser',
          sampleTransactions: processedTransactions.slice(0, 3)
        }
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      return NextResponse.json({
        error: 'Failed to process PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}