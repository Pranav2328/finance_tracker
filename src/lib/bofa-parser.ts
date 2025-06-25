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
    const transactions: BofATransaction[] = [];
    let accountNumber = '';
    
    // Join all pages for easier parsing
    const fullText = pages.join('\n');
    
    // Extract account number - look for pattern like "Account# 4400 6630 1110 8217"
    const accountMatch = fullText.match(/Account[#\s]+(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i);
    if (accountMatch) {
      accountNumber = accountMatch[1].replace(/\s/g, '');
    }
    
    // Split into lines for transaction parsing
    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
    
    let currentSection: 'payments' | 'purchases' | null = null;
    let inTransactionSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect sections
      if (line.match(/Payments\s+and\s+Other\s+Credits/i)) {
        currentSection = 'payments';
        inTransactionSection = true;
        continue;
      } else if (line.match(/Purchases\s+and\s+Adjustments/i)) {
        currentSection = 'purchases';
        inTransactionSection = true;
        continue;
      }
      
      // Stop parsing if we hit totals or interest sections
      if (line.match(/TOTAL\s+(PAYMENTS|PURCHASES)/i) || 
          line.match(/Interest\s+Charged/i) ||
          line.match(/Fees\s+Charged/i)) {
        if (line.match(/TOTAL\s+PAYMENTS/i)) {
          currentSection = null;
        }
        continue;
      }
      
      // Skip headers and other non-transaction lines
      if (!inTransactionSection || !currentSection) continue;
      if (line.match(/Transaction.*Date.*Description/i)) continue;
      if (line.match(/continued\s+on\s+next\s+page/i)) continue;
      
      // Try to parse transaction
      const transaction = parseTransactionFromLine(line, lines, i, currentSection);
      if (transaction) {
        transactions.push(transaction);
      }
    }
    
    console.log(`Total BofA transactions parsed: ${transactions.length}`);
    return { transactions, accountNumber };
  }
  
  function parseTransactionFromLine(
    line: string,
    allLines: string[],
    lineIndex: number,
    type: 'payments' | 'purchases'
  ): BofATransaction | null {
    
    // Check if line starts with date pattern MM/DD
    if (!/^\d{2}\/\d{2}/.test(line)) {
      return null;
    }
    
    // Clean and normalize the line
    const cleanLine = line.replace(/\s+/g, ' ').trim();
    
    // Try to parse with flexible pattern
    // Looking for: MM/DD MM/DD [description with spaces] [4-digit ref] [4-digit acct] [amount]
    
    // First, try to find the amount at the end (with or without minus sign)
    const amountMatch = cleanLine.match(/([-]?\d{1,3}(?:,\d{3})*\.\d{2})$/);
    if (!amountMatch) {
      return null;
    }
    
    const amount = amountMatch[1];
    const beforeAmount = cleanLine.substring(0, cleanLine.length - amount.length).trim();
    
    // Now try to find the account number (4 digits) before the amount
    const acctMatch = beforeAmount.match(/(\d{4})$/);
    if (!acctMatch) {
      return null;
    }
    
    const accountNum = acctMatch[1];
    const beforeAcct = beforeAmount.substring(0, beforeAmount.length - 4).trim();
    
    // Find reference number (4 digits) before account
    const refMatch = beforeAcct.match(/(\d{4})$/);
    if (!refMatch) {
      return null;
    }
    
    const refNum = refMatch[1];
    const beforeRef = beforeAcct.substring(0, beforeAcct.length - 4).trim();
    
    // Now parse the dates and description from what's left
    const dateMatch = beforeRef.match(/^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+)$/);
    if (!dateMatch) {
      return null;
    }
    
    const [, txDate, postDate, description] = dateMatch;
    
    return {
      transactionDate: txDate,
      postingDate: postDate,
      description: description.trim(),
      referenceNumber: refNum,
      accountNumber: accountNum,
      amount: parseFloat(amount.replace(/,/g, '')),
      type
    };
  }