import type { ExternalEvidenceRecord, PubMedSearchOptions } from '../phase5Types';

const DEFAULT_MAX_RESULTS = 8;
const PUBMED_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const PUBMED_PUBLIC_URL = 'https://pubmed.ncbi.nlm.nih.gov';

type ESearchResponse = {
  esearchresult?: {
    idlist?: string[];
  };
};

type ESummaryAuthor = {
  name?: string;
  authtype?: string;
  clusterid?: string;
};

type ESummaryItem = {
  uid?: string;
  title?: string;
  pubdate?: string;
  fulljournalname?: string;
  authors?: ESummaryAuthor[];
};

type ESummaryResponse = {
  result?: {
    uids?: string[];
    [key: string]: unknown;
  };
};

type ParsedXmlArticle = {
  abstractText: string;
  publicationTypes: string[];
  authors: string[];
  keywords: string[];
};

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toIsoDate(pubDate: string | undefined): string | null {
  if (!pubDate) return null;
  const direct = new Date(pubDate);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const year = pubDate.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return null;
  return `${year}-01-01T00:00:00.000Z`;
}

function extractAll(pattern: RegExp, value: string): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    if (match[1]) {
      results.push(normalizeWhitespace(decodeXmlEntities(match[1])));
    }
  }
  return results.filter(Boolean);
}

function parsePubMedXml(xml: string): Map<string, ParsedXmlArticle> {
  const articleMap = new Map<string, ParsedXmlArticle>();
  const articlePattern = /<PubmedArticle[\s\S]*?<\/PubmedArticle>/g;
  const articleBlocks = xml.match(articlePattern) || [];

  for (const block of articleBlocks) {
    const pmid = block.match(/<PMID[^>]*>([\s\S]*?)<\/PMID>/)?.[1];
    if (!pmid) continue;

    const publicationTypes = extractAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g, block);
    const abstractParts = extractAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g, block);
    const keywords = extractAll(/<Keyword[^>]*>([\s\S]*?)<\/Keyword>/g, block);

    const authors: string[] = [];
    const authorBlocks = block.match(/<Author[\s\S]*?<\/Author>/g) || [];
    for (const authorBlock of authorBlocks) {
      const collective = authorBlock.match(/<CollectiveName[^>]*>([\s\S]*?)<\/CollectiveName>/)?.[1];
      if (collective) {
        authors.push(normalizeWhitespace(decodeXmlEntities(collective)));
        continue;
      }

      const lastName = authorBlock.match(/<LastName[^>]*>([\s\S]*?)<\/LastName>/)?.[1];
      const foreName = authorBlock.match(/<ForeName[^>]*>([\s\S]*?)<\/ForeName>/)?.[1];
      const fullName = [foreName, lastName]
        .filter(Boolean)
        .map(part => normalizeWhitespace(decodeXmlEntities(part || '')))
        .join(' ')
        .trim();

      if (fullName) {
        authors.push(fullName);
      }
    }

    articleMap.set(normalizeWhitespace(pmid), {
      abstractText: abstractParts.join(' ').trim(),
      publicationTypes,
      authors,
      keywords,
    });
  }

  return articleMap;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`PubMed request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'application/xml,text/xml' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`PubMed request failed: ${response.status}`);
  }
  return response.text();
}

export class PubMedClient {
  constructor(private readonly apiKey: string | null = null) {}

  async search(query: string, options: PubMedSearchOptions = {}): Promise<ExternalEvidenceRecord[]> {
    const maxResults = Math.max(1, Math.min(options.maxResults || DEFAULT_MAX_RESULTS, 25));
    const apiKey = options.apiKey || this.apiKey || undefined;

    const eSearchParams = new URLSearchParams({
      db: 'pubmed',
      retmode: 'json',
      retmax: `${maxResults}`,
      sort: 'pub+date',
      term: query,
    });

    if (options.sinceDate) {
      eSearchParams.set('mindate', options.sinceDate.slice(0, 10));
      eSearchParams.set('datetype', 'pdat');
    }

    if (apiKey) {
      eSearchParams.set('api_key', apiKey);
    }

    const searchUrl = `${PUBMED_EUTILS_BASE}/esearch.fcgi?${eSearchParams.toString()}`;
    const searchResponse = await fetchJson<ESearchResponse>(searchUrl);
    const idList = searchResponse.esearchresult?.idlist || [];
    if (idList.length === 0) return [];

    const idCsv = idList.join(',');
    const eSummaryParams = new URLSearchParams({
      db: 'pubmed',
      retmode: 'json',
      id: idCsv,
    });
    const eFetchParams = new URLSearchParams({
      db: 'pubmed',
      retmode: 'xml',
      id: idCsv,
    });
    if (apiKey) {
      eSummaryParams.set('api_key', apiKey);
      eFetchParams.set('api_key', apiKey);
    }

    const [summaryResponse, xmlPayload] = await Promise.all([
      fetchJson<ESummaryResponse>(`${PUBMED_EUTILS_BASE}/esummary.fcgi?${eSummaryParams.toString()}`),
      fetchText(`${PUBMED_EUTILS_BASE}/efetch.fcgi?${eFetchParams.toString()}`),
    ]);

    const parsedXml = parsePubMedXml(xmlPayload);
    const result = summaryResponse.result || {};
    const summaryUids = Array.isArray(result.uids) ? result.uids : idList;

    const records: ExternalEvidenceRecord[] = [];
    for (const uid of summaryUids) {
      const summary = result[uid] as ESummaryItem | undefined;
      const parsed = parsedXml.get(uid);
      const title = normalizeWhitespace(summary?.title || '');
      if (!title) continue;

      const summaryAuthors = (summary?.authors || [])
        .map(author => normalizeWhitespace(author.name || ''))
        .filter(Boolean);

      records.push({
        externalId: uid,
        title,
        abstractText: parsed?.abstractText || '',
        journal: summary?.fulljournalname || null,
        publicationDate: toIsoDate(summary?.pubdate),
        publicationTypes: parsed?.publicationTypes || [],
        authors: parsed?.authors.length ? parsed.authors : summaryAuthors,
        keywords: parsed?.keywords || [],
        url: `${PUBMED_PUBLIC_URL}/${uid}/`,
        rawPayload: {
          summary,
        },
      });
    }

    return records;
  }
}
