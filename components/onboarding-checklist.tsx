import Link from 'next/link';

export interface OnboardingState {
  hasClients: boolean;
  hasBatch: boolean;
  hasApprovedInternal: boolean;
  hasSentToClient: boolean;
  whatsappConnected: boolean;
}

const STEPS: Array<{
  key: keyof OnboardingState;
  label: string;
  href: string;
}> = [
  { key: 'hasClients', label: 'Carga tu primer cliente final (~15 min)', href: '/clients/new' },
  { key: 'hasBatch', label: 'Genera su primer batch semanal', href: '/clients' },
  { key: 'hasApprovedInternal', label: 'Revisa y aprueba piezas internamente', href: '/clients' },
  { key: 'hasSentToClient', label: 'Envíaselas a tu cliente (link web o WhatsApp)', href: '/clients' },
  { key: 'whatsappConnected', label: 'Conecta el WhatsApp de tu agencia', href: '/settings' },
];

export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  const doneCount = STEPS.filter((s) => state[s.key]).length;
  if (doneCount === STEPS.length) return null;

  return (
    <div className="card mb-6 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Primeros pasos con Bitélica Briefs
        </h2>
        <span className="text-xs text-slate-400">
          {doneCount}/{STEPS.length} completados
        </span>
      </div>
      <ul className="space-y-2">
        {STEPS.map((step) => {
          const done = state[step.key];
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  done
                    ? 'text-slate-400 line-through'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {done ? '✓' : ''}
                </span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
