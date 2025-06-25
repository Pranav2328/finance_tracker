// lib/pdf-parser.ts
import PDFParser from 'pdf2json';

export async function extractPDFText(buffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('PDF parsing error:', errData.parserError);
      reject(errData.parserError);
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        console.log('PDF parsed successfully');
        
        // Extract text from all pages
        const pages: string[] = [];
        
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            let pageText = '';
            
            if (page.Texts) {
              // Sort texts by Y position (top to bottom), then X position (left to right)
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                if (Math.abs(a.y - b.y) < 0.1) {
                  return a.x - b.x;
                }
                return a.y - b.y;
              });
              
              let lastY = -1;
              sortedTexts.forEach((text: any) => {
                // Add newline if Y position changed significantly
                if (lastY !== -1 && Math.abs(text.y - lastY) > 0.5) {
                  pageText += '\n';
                }
                
                // Decode the text
                if (text.R && text.R[0] && text.R[0].T) {
                  const decodedText = decodeURIComponent(text.R[0].T);
                  pageText += decodedText + ' ';
                }
                
                lastY = text.y;
              });
            }
            
            pages.push(pageText.trim());
          });
        }
        
        console.log(`Extracted ${pages.length} pages`);
        console.log('First page sample:', pages[0]?.substring(0, 500));
        
        resolve(pages);
      } catch (error) {
        console.error('Error processing PDF data:', error);
        reject(error);
      }
    });
    
    // Parse the buffer
    pdfParser.parseBuffer(buffer);
  });
}