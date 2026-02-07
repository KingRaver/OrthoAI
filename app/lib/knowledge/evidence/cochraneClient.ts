import type { ExternalEvidenceRecord, PubMedSearchOptions } from '../phase5Types';
import { PubMedClient } from './pubmedClient';

/**
 * Cochrane integration adapter.
 * Uses PubMed journal filtering for "Cochrane Database of Systematic Reviews"
 * so the sync/search flow stays compatible with local-first deployments.
 */
export class CochraneClient {
  private pubmed: PubMedClient;

  constructor(apiKey: string | null = null) {
    this.pubmed = new PubMedClient(apiKey);
  }

  async search(query: string, options: PubMedSearchOptions = {}): Promise<ExternalEvidenceRecord[]> {
    const cochraneQuery = `(${query}) AND ("Cochrane Database Syst Rev"[Journal])`;
    const records = await this.pubmed.search(cochraneQuery, options);

    return records.map(record => ({
      ...record,
      rawPayload: {
        ...(record.rawPayload || {}),
        cochrane_adapter: true,
      },
    }));
  }
}
