import { getStorage } from '@/app/lib/memory';
import type { PatientCase, CaseEvent, CaseConversationLink } from './types';
import { createHash } from 'crypto';

export interface CaseCreateInput {
  title: string;
  status?: 'active' | 'closed';
  demographics?: Record<string, unknown> | null;
  history?: string | null;
  complaints?: string | null;
  imaging?: Record<string, unknown> | null;
  labs?: Record<string, unknown> | null;
  medications?: string | null;
  allergies?: string | null;
  tags?: string[];
}

export type CaseUpdateInput = Partial<CaseCreateInput>;

export interface CaseEventInput {
  event_type: string;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  occurred_at?: string | null;
}

type DbCaseRow = {
  id: string;
  title: string;
  status: string;
  demographics: string | null;
  history: string | null;
  complaints: string | null;
  imaging: string | null;
  labs: string | null;
  medications: string | null;
  allergies: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
};

type DbEventRow = {
  id: string;
  case_id: string;
  event_type: string;
  summary: string | null;
  details: string | null;
  occurred_at: string | null;
  created_at: string;
};

type DbConversationRow = {
  case_id: string;
  conversation_id: string;
  created_at: string;
};

function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function generateId(prefix: string): string {
  const hash = createHash('sha1');
  hash.update(`${prefix}-${Date.now()}-${Math.random()}`);
  return `${prefix}_${hash.digest('hex').slice(0, 16)}`;
}

export class CaseManager {
  private db = getStorage().getDatabase();

  listCases(limit = 50, offset = 0): PatientCase[] {
    const stmt = this.db.prepare(`
      SELECT * FROM patient_cases
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as DbCaseRow[];
    return rows.map(row => this.mapCase(row));
  }

  createCase(input: CaseCreateInput): PatientCase {
    const id = generateId('case');
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO patient_cases
      (id, title, status, demographics, history, complaints, imaging, labs, medications, allergies, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.title,
      input.status || 'active',
      stringify(input.demographics),
      input.history || null,
      input.complaints || null,
      stringify(input.imaging),
      stringify(input.labs),
      input.medications || null,
      input.allergies || null,
      stringify(input.tags || []),
      now,
      now
    );

    return this.getCase(id)!;
  }

  getCase(caseId: string): PatientCase | null {
    const stmt = this.db.prepare(`SELECT * FROM patient_cases WHERE id = ?`);
    const row = stmt.get(caseId) as DbCaseRow | undefined;
    if (!row) return null;
    return this.mapCase(row);
  }

  updateCase(caseId: string, updates: CaseUpdateInput): PatientCase | null {
    const existing = this.getCase(caseId);
    if (!existing) return null;

    const next = {
      ...existing,
      ...updates,
      tags: updates.tags ?? existing.tags,
      demographics: updates.demographics ?? existing.demographics,
      imaging: updates.imaging ?? existing.imaging,
      labs: updates.labs ?? existing.labs,
    };

    const stmt = this.db.prepare(`
      UPDATE patient_cases
      SET title = ?,
          status = ?,
          demographics = ?,
          history = ?,
          complaints = ?,
          imaging = ?,
          labs = ?,
          medications = ?,
          allergies = ?,
          tags = ?,
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      next.title,
      next.status,
      stringify(next.demographics),
      next.history || null,
      next.complaints || null,
      stringify(next.imaging),
      stringify(next.labs),
      next.medications || null,
      next.allergies || null,
      stringify(next.tags || []),
      new Date().toISOString(),
      caseId
    );

    return this.getCase(caseId);
  }

  deleteCase(caseId: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM patient_cases WHERE id = ?`);
    const result = stmt.run(caseId);
    return result.changes > 0;
  }

  listEvents(caseId: string): CaseEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM case_events
      WHERE case_id = ?
      ORDER BY occurred_at ASC, created_at ASC
    `);
    const rows = stmt.all(caseId) as DbEventRow[];
    return rows.map(row => this.mapEvent(row));
  }

  addEvent(caseId: string, input: CaseEventInput): CaseEvent {
    const id = generateId('event');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO case_events
      (id, case_id, event_type, summary, details, occurred_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      caseId,
      input.event_type,
      input.summary || null,
      stringify(input.details),
      input.occurred_at || null,
      now
    );

    return this.getEvent(id)!;
  }

  getEvent(eventId: string): CaseEvent | null {
    const stmt = this.db.prepare(`SELECT * FROM case_events WHERE id = ?`);
    const row = stmt.get(eventId) as DbEventRow | undefined;
    if (!row) return null;
    return this.mapEvent(row);
  }

  linkConversation(caseId: string, conversationId: string): CaseConversationLink {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO case_conversations
      (case_id, conversation_id)
      VALUES (?, ?)
    `);
    stmt.run(caseId, conversationId);
    const row = this.db.prepare(`
      SELECT * FROM case_conversations
      WHERE case_id = ? AND conversation_id = ?
    `).get(caseId, conversationId) as DbConversationRow;

    return {
      case_id: row.case_id,
      conversation_id: row.conversation_id,
      created_at: row.created_at
    };
  }

  listLinkedConversations(caseId: string): CaseConversationLink[] {
    const stmt = this.db.prepare(`
      SELECT * FROM case_conversations
      WHERE case_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(caseId) as DbConversationRow[];
    return rows.map(row => ({
      case_id: row.case_id,
      conversation_id: row.conversation_id,
      created_at: row.created_at
    }));
  }

  exportSummary(caseId: string): string | null {
    const patientCase = this.getCase(caseId);
    if (!patientCase) return null;
    const events = this.listEvents(caseId);

    const lines = [
      `Case: ${patientCase.title}`,
      `Status: ${patientCase.status}`,
      `Created: ${patientCase.created_at}`,
      `Updated: ${patientCase.updated_at}`,
      ''
    ];

    if (patientCase.demographics) {
      lines.push(`Demographics: ${JSON.stringify(patientCase.demographics)}`);
    }
    if (patientCase.complaints) {
      lines.push(`Chief Complaint: ${patientCase.complaints}`);
    }
    if (patientCase.history) {
      lines.push(`History: ${patientCase.history}`);
    }
    if (patientCase.imaging) {
      lines.push(`Imaging: ${JSON.stringify(patientCase.imaging)}`);
    }
    if (patientCase.labs) {
      lines.push(`Labs: ${JSON.stringify(patientCase.labs)}`);
    }
    if (patientCase.medications) {
      lines.push(`Medications: ${patientCase.medications}`);
    }
    if (patientCase.allergies) {
      lines.push(`Allergies: ${patientCase.allergies}`);
    }
    if (patientCase.tags.length > 0) {
      lines.push(`Tags: ${patientCase.tags.join(', ')}`);
    }

    if (events.length > 0) {
      lines.push('', 'Timeline:');
      events.forEach(event => {
        const when = event.occurred_at || event.created_at;
        lines.push(`- ${when} [${event.event_type}] ${event.summary || ''}`.trim());
      });
    }

    return lines.join('\n');
  }

  private mapCase(row: DbCaseRow): PatientCase {
    return {
      id: row.id,
      title: row.title,
      status: row.status === 'closed' ? 'closed' : 'active',
      demographics: parseJson<Record<string, unknown>>(row.demographics),
      history: row.history,
      complaints: row.complaints,
      imaging: parseJson<Record<string, unknown>>(row.imaging),
      labs: parseJson<Record<string, unknown>>(row.labs),
      medications: row.medications,
      allergies: row.allergies,
      tags: parseJson<string[]>(row.tags) || [],
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapEvent(row: DbEventRow): CaseEvent {
    return {
      id: row.id,
      case_id: row.case_id,
      event_type: row.event_type,
      summary: row.summary,
      details: parseJson<Record<string, unknown>>(row.details),
      occurred_at: row.occurred_at,
      created_at: row.created_at
    };
  }
}

let sharedCaseManager: CaseManager | null = null;

export function getCaseManager(): CaseManager {
  if (!sharedCaseManager) {
    sharedCaseManager = new CaseManager();
  }
  return sharedCaseManager;
}
