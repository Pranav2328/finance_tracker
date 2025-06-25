// types/pdf2json.d.ts
declare module 'pdf2json' {
    export default class PDFParser {
      constructor();
      on(event: 'pdfParser_dataError', callback: (errData: any) => void): void;
      on(event: 'pdfParser_dataReady', callback: (pdfData: any) => void): void;
      parseBuffer(buffer: Buffer): void;
      loadPDF(path: string, verbosity?: number): void;
    }
  }