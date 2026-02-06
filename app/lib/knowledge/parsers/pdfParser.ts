import type { Parser, ParseResult, ParseMetadata } from './types';
import type { InfoResult, TextResult } from 'pdf-parse';

type PdfInfo = {
  Title?: string;
  Author?: string;
  CreationDate?: string;
  ModDate?: string;
};

export class PdfParser implements Parser {
  supportedTypes = ['application/pdf', 'pdf'];

  async parse(buffer: Buffer | ArrayBuffer): Promise<ParseResult> {
    // Dynamic import to avoid bundling issues
    const { PDFParse } = await import('pdf-parse');

    const inputBuffer = buffer instanceof ArrayBuffer
      ? Buffer.from(buffer)
      : buffer;

    const parser = new PDFParse({ data: inputBuffer });
    let textResult: TextResult;
    let infoResult: InfoResult;
    try {
      [textResult, infoResult] = await Promise.all([
        parser.getText(),
        parser.getInfo()
      ]);
    } finally {
      await parser.destroy();
    }

    const info = infoResult.info as PdfInfo | undefined;
    const dates = infoResult.getDateNode();
    const creationDate = dates.CreationDate
      ? dates.CreationDate.toISOString()
      : info?.CreationDate;
    const modificationDate = dates.ModDate
      ? dates.ModDate.toISOString()
      : info?.ModDate;

    const metadata: ParseMetadata = {
      pageCount: infoResult.total ?? textResult.total ?? 0,
      title: info?.Title || undefined,
      author: info?.Author || undefined,
      creationDate: creationDate || undefined,
      modificationDate: modificationDate || undefined,
      contentType: 'application/pdf'
    };

    // Clean up extracted text
    const cleanedText = this.cleanText(textResult.text);

    return {
      text: cleanedText,
      metadata
    };
  }

  private cleanText(text: string): string {
    return text
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Remove page break artifacts
      .replace(/\f/g, '\n\n')
      // Normalize spaces
      .replace(/[ \t]+/g, ' ')
      // Trim lines
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }
}

// Singleton instance
let sharedPdfParser: PdfParser | null = null;

export function getPdfParser(): PdfParser {
  if (!sharedPdfParser) {
    sharedPdfParser = new PdfParser();
  }
  return sharedPdfParser;
}
