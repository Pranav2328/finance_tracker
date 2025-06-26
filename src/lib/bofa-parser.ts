// lib/bofa-parser.ts

export interface BofATransaction {
  transactionDate: string;
  postingDate: string;
  description: string;
  referenceNumber: string;
  accountNumber: string;
  amount: number;
  type: 'payment' | 'purchase';
}

export function parseBofAStatement(pages: string[]): {
  transactions: BofATransaction[];
  accountNumber: string;
} {
  console.log('Starting BofA statement parsing...');
  
  const transactions: BofATransaction[] = [];
  let accountNumber = '';
  
  // Join all pages for easier parsing
  const fullText = pages.join('\n');
  console.log('Full text length:', fullText.length);
  
  // Extract account number - look for various patterns
  const accountPatterns = [
    /Account[#\s]*(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i,
    /Account[:\s]*(\d{4}[-\s]*\d{4}[-\s]*\d{4}[-\s]*\d{4})/i,
    /(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/
  ];
  
  for (const pattern of accountPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      accountNumber = match[1].replace(/[\s-]/g, '');
      console.log('Found account number:', accountNumber);
      break;
    }
  }
  
  // Split into lines for transaction parsing
  const lines = fullText.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  
  console.log(`Processing ${lines.length} lines...`);
  
  let currentSection: 'payments' | 'purchases' | null = null;
  let inTransactionSection = false;
  let foundTransactionHeader = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    
    // Debug: log lines that might be section headers
    if (line.toLowerCase().includes('payment') || line.toLowerCase().includes('purchase')) {
      console.log(`Potential section header at line ${i}: "${line}"`);
    }
    
    // Detect section headers with more flexible matching
    if (line.match(/(payments?\s*(and\s*other\s*credits?)?|credits?)/i)) {
      currentSection = 'payments';
      inTransactionSection = true;
      foundTransactionHeader = false;
      console.log(`Found payments section at line ${i}: "${line}"`);
      continue;
    } else if (line.match(/(purchases?\s*(and\s*adjustments?)?|transactions?)/i)) {
      currentSection = 'purchases';
      inTransactionSection = true;
      foundTransactionHeader = false;
      console.log(`Found purchases section at line ${i}: "${line}"`);
      continue;
    }
    
    // Look for transaction headers
    if (inTransactionSection && !foundTransactionHeader) {
      if (line.match(/(trans|date|description|amount|reference)/i)) {
        foundTransactionHeader = true;
        console.log(`Found transaction header at line ${i}: "${line}"`);
        continue;
      }
    }
    
    // Stop parsing at totals or other sections
    if (line.match(/(total\s+(payments?|purchases?)|interest\s+charged|fees?\s+charged|new\s+balance)/i)) {
      console.log(`Found section end at line ${i}: "${line}"`);
      if (line.match(/total\s+payments?/i)) {
        currentSection = null;
        inTransactionSection = false;
      }
      continue;
    }
    
    // Skip non-transaction lines
    if (!inTransactionSection || !currentSection) continue;
    
    // Try to parse transaction with multiple approaches
    const transaction = parseTransactionFromLine(line, allLines, i, currentSection) ||
                       parseTransactionAlternative(line, currentSection) ||
                       parseTransactionLoose(line, currentSection);
    
    if (transaction) {
      transactions.push(transaction);
      console.log(`Found transaction: ${transaction.description} - $${transaction.amount}`);
    }
  }
  
  console.log(`Total BofA transactions parsed: ${transactions.length}`);
  
  // If no transactions found with BofA parser, try a more generic approach
  if (transactions.length === 0) {
    console.log('BofA parser found no transactions, trying generic parser...');
    return parseGenericTransactions(lines);
  }
  
  return { transactions, accountNumber };
}

function parseTransactionFromLine(
  line: string,
  allLines: string[],
  lineIndex: number,
  type: 'payments' | 'purchases'
): BofATransaction | null {
  
  // Skip obviously non-transaction lines
  if (line.length < 10) return null;
  if (line.match(/(continued|page|total|balance|interest|fee)/i)) return null;
  
  // Check if line starts with date pattern MM/DD
  if (!/^\d{2}\/\d{2}/.test(line)) {
    return null;
  }
  
  // Clean and normalize the line
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  
  // Try to find the amount at the end (with or without minus sign)
  const amountMatch = cleanLine.match(/([-]?\d{1,3}(?:,\d{3})*\.\d{2})$/);
  if (!amountMatch) {
    return null;
  }
  
  const amount = amountMatch[1];
  const beforeAmount = cleanLine.substring(0, cleanLine.length - amount.length).trim();
  
  // Try to find account/reference numbers before amount
  const parts = beforeAmount.split(/\s+/);
  if (parts.length < 4) return null; // Need at least: date1, date2, description, ref/acct
  
  // Amount parsing
  const parsedAmount = parseFloat(amount.replace(/,/g, ''));
  
  // Flexible parsing - look for two dates at the start
  const dateMatch = cleanLine.match(/^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+?)(\d{4})\s+(\d{4})\s+[-]?\d/);
  
  if (dateMatch) {
    const [, txDate, postDate, description, ref, acct] = dateMatch;
    
    return {
      transactionDate: txDate,
      postingDate: postDate,
      description: description.trim(),
      referenceNumber: ref,
      accountNumber: acct,
      amount: Math.abs(parsedAmount), // Store as positive
      type
    };
  }
  
  return null;
}

function parseTransactionAlternative(line: string, type: 'payments' | 'purchases'): BofATransaction | null {
  // Alternative parsing approach for different formats
  
  // Pattern: MM/DD Description $Amount
  const simpleMatch = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+\$?([-]?\d{1,3}(?:,\d{3})*\.\d{2})$/);
  if (simpleMatch) {
    const [, date, description, amount] = simpleMatch;
    
    return {
      transactionDate: date,
      postingDate: date,
      description: description.trim(),
      referenceNumber: '0000',
      accountNumber: '0000',
      amount: Math.abs(parseFloat(amount.replace(/,/g, ''))),
      type
    };
  }
  
  return null;
}

function parseTransactionLoose(line: string, type: 'payments' | 'purchases'): BofATransaction | null {
  // Very loose parsing for edge cases
  
  // Look for any line with date and amount
  const looseMatch = line.match(/(\d{1,2}\/\d{1,2}).*?(\d{1,3}(?:,\d{3})*\.\d{2})/);
  if (looseMatch) {
    const [, date, amount] = looseMatch;
    
    // Extract description (everything between date and amount)
    const dateEnd = line.indexOf(date) + date.length;
    const amountStart = line.lastIndexOf(amount);
    const description = line.substring(dateEnd, amountStart).trim();
    
    if (description.length > 2) {
      return {
        transactionDate: date.padStart(5, '0'), // Ensure MM/DD format
        postingDate: date.padStart(5, '0'),
        description: description,
        referenceNumber: '0000',
        accountNumber: '0000',
        amount: parseFloat(amount.replace(/,/g, '')),
        type
      };
    }
  }
  
  return null;
}

function parseGenericTransactions(lines: string[]): { transactions: BofATransaction[]; accountNumber: string } {
  console.log('Using generic transaction parser...');
  
  const transactions: BofATransaction[] = [];
  
  for (const line of lines) {
    // Look for any line that contains a date and amount pattern
    const genericMatch = line.match(/(\d{1,2}\/\d{1,2}\/?\d{0,4}).*?(\d{1,3}(?:,\d{3})*\.\d{2})/);
    
    if (genericMatch && line.length > 15) {
      const [, dateStr, amountStr] = genericMatch;
      
      // Skip header lines
      if (line.toLowerCase().includes('date') && line.toLowerCase().includes('amount')) {
        continue;
      }
      
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      if (amount > 0) {
        // Extract description
        const dateEnd = line.indexOf(dateStr) + dateStr.length;
        const amountStart = line.lastIndexOf(amountStr);
        let description = line.substring(dateEnd, amountStart).trim();
        
        // Clean up description
        description = description.replace(/^\W+|\W+$/g, '');
        
        if (description.length > 2) {
          transactions.push({
            transactionDate: dateStr.includes('/') ? dateStr : `${dateStr}/25`, // Add year if missing
            postingDate: dateStr.includes('/') ? dateStr : `${dateStr}/25`,
            description: description,
            referenceNumber: '0000',
            accountNumber: '0000',
            amount: amount,
            type: 'purchase'
          });
        }
      }
    }
  }
  
  console.log(`Generic parser found ${transactions.length} transactions`);
  return { transactions, accountNumber: '' };
}