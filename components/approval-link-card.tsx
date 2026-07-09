'use client';

import { useState } from 'react';

// Tarjeta persistente con el link de aprobación del cliente.
// Visible siempre que el batch esté enviado — el link nunca "se pierde".
export function ApprovalLinkCard({ approveUrl }: { approveUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(approveUrl);
    } catch {
      // Fallback para contextos sin clipboard API
      const input = document.createElement('input');
      input.value = approveUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card mb-6 border-brand-200 bg-brand-50/40 p-5">
      <p className="mb-1 text-sm font-semibold text-slate-900">
        🔗 Link de aprobación del cliente
      </p>
      <p className="mb-3 text-xs text-slate-500">
        Compártelo con tu cliente por el canal que prefieras. Vence 14 días después del
        envío.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={approveUrl}
          onFocus={(e) => e.target.select()}
          className="input flex-1 bg-white font-mono text-xs"
        />
        <div className="flex shrink-0 gap-2">
          <button onClick={copy} className="btn-primary">
            {copied ? '¡Copiado!' : 'Copiar link'}
          </button>
          <a
            href={approveUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            Abrir
          </a>
        </div>
      </div>
    </div>
  );
}
