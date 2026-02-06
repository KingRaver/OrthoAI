export interface PatientCase {
  id: string;
  title: string;
  status: 'active' | 'closed';
  demographics: Record<string, unknown> | null;
  history: string | null;
  complaints: string | null;
  imaging: Record<string, unknown> | null;
  labs: Record<string, unknown> | null;
  medications: string | null;
  allergies: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CaseEvent {
  id: string;
  case_id: string;
  event_type: string;
  summary: string | null;
  details: Record<string, unknown> | null;
  occurred_at: string | null;
  created_at: string;
}

export interface CaseConversationLink {
  case_id: string;
  conversation_id: string;
  created_at: string;
}
