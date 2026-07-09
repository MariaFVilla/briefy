// Tipos del modelo de datos de Briefy.
// Mantener sincronizados con supabase/migrations.

export type WhatsappStatus = 'none' | 'pending' | 'connected';
export type AgencyPlan = 'starter' | 'growth' | 'pro' | 'founder';
export type MemberRole = 'owner' | 'editor';
export type BatchStatus = 'generating' | 'internal_review' | 'sent' | 'completed';
export type PieceStatus =
  | 'draft'
  | 'internal_review'
  | 'approved_internal'
  | 'sent_to_client'
  | 'client_approved'
  | 'changes_requested'
  | 'regenerating'
  | 'rejected'
  | 'final';
export type LearningSource = 'approval' | 'rejection' | 'comment';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'whatsapp' | 'web';
export type Classification =
  | 'approved'
  | 'change_requested'
  | 'rejected'
  | 'question'
  | 'unclear';

export type Platform = 'instagram' | 'facebook' | 'tiktok';
export type PieceFormat = 'post' | 'carrusel' | 'reel-guion' | 'story' | 'guion';

export interface Agency {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string;
  whatsapp_status: WhatsappStatus;
  plan: AgencyPlan;
  timezone: string;
  created_at: string;
}

export interface AgencyMember {
  id: string;
  agency_id: string;
  auth_user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface EndClient {
  id: string;
  agency_id: string;
  name: string;
  business_type: string | null;
  city: string | null;
  phone_whatsapp: string | null;
  pieces_per_week: number;
  active: boolean;
  created_at: string;
}

export interface ClientProfile {
  id: string;
  end_client_id: string;
  business_description: string | null;
  products_services: string | null;
  target_audience: string | null;
  tone: string | null;
  forbidden_words: string[];
  preferred_words: string[];
  visual_references: string | null;
  platforms: PlatformConfig[];
  objectives: string | null;
  updated_at: string;
}

export interface PlatformConfig {
  platform: Platform;
  formats: PieceFormat[];
}

export interface ClientLearning {
  id: string;
  end_client_id: string;
  learning_text: string;
  source: LearningSource;
  source_piece_id: string | null;
  active: boolean;
  created_at: string;
}

export type PieceObjective = 'alcance' | 'conexion' | 'venta';

export interface ContentBatch {
  id: string;
  end_client_id: string;
  week_start: string;
  status: BatchStatus;
  approval_token: string;
  approval_token_expires_at: string | null;
  trends_summary: string | null;
  created_at: string;
}

export interface Piece {
  id: string;
  batch_id: string;
  platform: Platform;
  format: PieceFormat;
  objective: PieceObjective | null;
  copy_text: string;
  visual_brief: string;
  strategic_argument: string;
  status: PieceStatus;
  internal_approved_by: string | null;
  internal_approved_at: string | null;
  client_responded_at: string | null;
  position: number;
  created_at: string;
}

export interface PieceVersion {
  id: string;
  piece_id: string;
  version_number: number;
  copy_text: string;
  visual_brief: string;
  strategic_argument: string;
  change_reason: string | null;
  created_at: string;
}

export interface ClientMessage {
  id: string;
  end_client_id: string;
  batch_id: string | null;
  piece_id: string | null;
  direction: MessageDirection;
  channel: MessageChannel;
  raw_content: string;
  transcription: string | null;
  media_url: string | null;
  classified_as: Classification | null;
  created_at: string;
}

export interface GenerationLog {
  id: string;
  agency_id: string;
  batch_id: string | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  model: string;
  created_at: string;
}

export interface FaqTemplate {
  id: string;
  agency_id: string;
  question_pattern: string;
  answer_template: string;
  active: boolean;
  created_at: string;
}

// Payload que devuelve el RPC get_batch_by_token para la vista pública.
export interface PublicBatchView {
  batch_id: string;
  week_start: string;
  status: BatchStatus;
  client_name: string;
  agency: {
    name: string;
    logo_url: string | null;
    brand_color: string;
  };
  pieces: Array<{
    id: string;
    platform: Platform;
    format: PieceFormat;
    copy_text: string;
    visual_brief: string;
    status: PieceStatus;
    position: number;
  }>;
}

export const PIECE_STATUS_LABELS: Record<PieceStatus, string> = {
  draft: 'Borrador',
  internal_review: 'En revisión interna',
  approved_internal: 'Aprobada internamente',
  sent_to_client: 'Enviada al cliente',
  client_approved: 'Aprobada por el cliente',
  changes_requested: 'Cambios solicitados',
  regenerating: 'Regenerando',
  rejected: 'Descartada',
  final: 'Final',
};

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  generating: 'Generando',
  internal_review: 'En revisión',
  sent: 'Enviado al cliente',
  completed: 'Completado',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export const OBJECTIVE_LABELS: Record<PieceObjective, string> = {
  alcance: 'Alcance',
  conexion: 'Conexión',
  venta: 'Venta',
};

export const FORMAT_LABELS: Record<PieceFormat, string> = {
  post: 'Post',
  carrusel: 'Carrusel',
  'reel-guion': 'Guion de Reel',
  story: 'Story',
  guion: 'Guion',
};
