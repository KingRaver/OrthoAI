import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeManager } from '@/app/lib/knowledge';
import { getPdfParser } from '@/app/lib/knowledge/parsers/pdfParser';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const subspecialty = formData.get('subspecialty') as string | null;
    const diagnosisTags = formData.get('diagnosisTags') as string | null;
    const source = formData.get('source') as string | null;
    const version = formData.get('version') as string | null;
    const publishedAt = formData.get('publishedAt') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const mimeType = file.type;
    let extractedText: string;
    let contentType: string;

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // Parse PDF
      const parser = getPdfParser();
      const buffer = await file.arrayBuffer();
      const result = await parser.parse(buffer);
      extractedText = result.text;
      contentType = 'pdf';
    } else if (
      mimeType === 'text/plain' ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md')
    ) {
      // Plain text
      extractedText = await file.text();
      contentType = fileName.endsWith('.md') ? 'markdown' : 'text';
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType || fileName}` },
        { status: 400 }
      );
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'File contains no extractable text' },
        { status: 400 }
      );
    }

    // Parse diagnosis tags
    const tags = diagnosisTags
      ? diagnosisTags.split(',').map(tag => tag.trim()).filter(Boolean)
      : [];

    // Ingest document
    const km = getKnowledgeManager();
    const document = await km.ingestDocument({
      title: title || file.name,
      content: extractedText,
      source: source || null,
      version: version || null,
      subspecialty: subspecialty || null,
      diagnosisTags: tags,
      contentType,
      publishedAt: publishedAt || null
    });

    return NextResponse.json({
      document,
      extractedCharacters: extractedText.length,
      message: 'Document uploaded and ingested successfully'
    });
  } catch (error: unknown) {
    console.error('[Knowledge Upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
