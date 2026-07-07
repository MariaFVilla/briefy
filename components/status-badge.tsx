import type { BatchStatus, PieceStatus } from '@/lib/types/database';
import { BATCH_STATUS_LABELS, PIECE_STATUS_LABELS } from '@/lib/types/database';

const PIECE_COLORS: Record<PieceStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  internal_review: 'bg-amber-100 text-amber-700',
  approved_internal: 'bg-blue-100 text-blue-700',
  sent_to_client: 'bg-violet-100 text-violet-700',
  client_approved: 'bg-emerald-100 text-emerald-700',
  changes_requested: 'bg-orange-100 text-orange-700',
  regenerating: 'bg-cyan-100 text-cyan-700',
  rejected: 'bg-red-100 text-red-600',
  final: 'bg-emerald-600 text-white',
};

const BATCH_COLORS: Record<BatchStatus, string> = {
  generating: 'bg-cyan-100 text-cyan-700',
  internal_review: 'bg-amber-100 text-amber-700',
  sent: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export function PieceStatusBadge({ status }: { status: PieceStatus }) {
  return (
    <span className={`badge ${PIECE_COLORS[status]}`}>{PIECE_STATUS_LABELS[status]}</span>
  );
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  return (
    <span className={`badge ${BATCH_COLORS[status]}`}>{BATCH_STATUS_LABELS[status]}</span>
  );
}
