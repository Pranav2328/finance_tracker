// lib/pdf-parser.ts
import PDFParser from 'pdf2json';

export async function extractPDFText(buffer: Buffer): Promise<string[]> {
  console.log('Starting PDF text extraction...');
  
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('PDF parsing error:', errData.parserError);
      reject(new Error(`PDF parsing failed: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        console.log('PDF parsed successfully, processing data...');
        
        // Extract text from all pages
        const pages: string[] = [];
        
        if (!pdfData.Pages || !Array.isArray(pdfData.Pages)) {
          console.error('No pages found in PDF data');
          reject(new Error('No pages found in PDF'));
          return;
        }
        
        console.log(`Found ${pdfData.Pages.length} pages to process`);
        
        pdfData.Pages.forEach((page: any, pageIndex: number) => {
          console.log(`Processing page ${pageIndex + 1}...`);
          let pageText = '';
          
          if (!page.Texts || !Array.isArray(page.Texts)) {
            console.log(`Page ${pageIndex + 1} has no text elements`);
            pages.push('');
            return;
          }
          
          console.log(`Page ${pageIndex + 1} has ${page.Texts.length} text elements`);
          
          // Sort texts by Y position (top to bottom), then X position (left to right)
          const sortedTexts = page.Texts.sort((a: any, b: any) => {
            const yDiff = Math.abs(a.y - b.y);
            if (yDiff < 0.5) { // Same line threshold
              return a.x - b.x;
            }
            return a.y - b.y;
          });
          
          let lastY = -1;
          let lineText = '';
          
          sortedTexts.forEach((text: any, textIndex: number) => {
            try {
              // Check if we moved to a new line
              if (lastY !== -1 && Math.abs(text.y - lastY) > 0.5) {
                if (lineText.trim()) {
                  pageText += lineText.trim() + '\n';
                }
                lineText = '';
              }
              
              // Extract and decode the text
              if (text.R && Array.isArray(text.R)) {
                text.R.forEach((run: any) => {
                  if (run.T) {
                    try {
                      const decodedText = decodeURIComponent(run.T);
                      lineText += decodedText;
                    } catch (decodeError) {
                      // If decoding fails, try using the raw text
                      console.warn(`Failed to decode text: ${run.T}, using raw text`);
                      lineText += run.T;
                    }
                  }
                });
              }
              
              lastY = text.y;
            } catch (textError) {
              console.warn(`Error processing text element ${textIndex}:`, textError);
            }
          });
          
          // Add the last line
          if (lineText.trim()) {
            pageText += lineText.trim() + '\n';
          }
          
          console.log(`Page ${pageIndex + 1} extracted ${pageText.length} characters`);
          pages.push(pageText.trim());
        });
        
        console.log(`Successfully extracted ${pages.length} pages`);
        
        // Log samples for debugging
        pages.forEach((page, index) => {
          console.log(`Page ${index + 1} sample (first 200 chars):`, page.substring(0, 200));
        });
        
        resolve(pages);
      } catch (error) {
        console.error('Error processing PDF data:', error);
        reject(error);
      }
    });
    
    // Parse the buffer
    try {
      console.log(`Parsing PDF buffer of size: ${buffer.length} bytes`);
      pdfParser.parseBuffer(buffer);
    } catch (parseError) {
      console.error('Error initiating PDF parse:', parseError);
      reject(parseError);
    }
  });
}