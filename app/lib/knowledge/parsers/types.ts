export interface ParseResult {
  text: string;
  metadata: ParseMetadata;
}

export interface ParseMetadata {
  pageCount?: number;
  title?: string;
  author?: string;
  creationDate?: string;
  modificationDate?: string;
  contentType: string;
}

export interface Parser {
  parse(buffer: Buffer | ArrayBuffer): Promise<ParseResult>;
  supportedTypes: string[];
}
