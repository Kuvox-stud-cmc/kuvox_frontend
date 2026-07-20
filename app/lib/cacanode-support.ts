export interface CacanodeCitation {
  id: string;
  document_id: string;
  source_name: string;
  public_url?: string | null;
}

export interface CacanodeMessage {
  role: string;
  content: string;
  citations: CacanodeCitation[];
  action?: Record<string, unknown> | null;
  sequence_number?: number | null;
}
