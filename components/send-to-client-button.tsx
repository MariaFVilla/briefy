'use client';

import { useState, useTransition } from 'react';
import { sendApprovedToClient } from '@/lib/actions/batch';

export function SendToClientButton({
  batchId,
  approvedCount,
  whatsappConnected,
  clientHasPhone,
}: {
  batchId: string;
  approvedCount: number;
  whatsappConnected: boolean;
  clientHasPhone: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSend(channel: 'whatsapp' | 'web') {
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendApprovedToClient(batchId, channel);
        if (channel === 'web' && result.approveUrl) {
          setApproveUrl(result.approveUrl);
        } else {
          setOpen(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al enviar');
      }
    });
  }

  async function copyLink() {
    if (!approveUrl) return;
    await navigator.clipboard.writeText(approveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-primary">
        📤 Enviar aprobadas al cliente ({approvedCount})
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-20 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          {approveUrl ? (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-900">
                ✅ Piezas enviadas. Comparte este link con tu cliente:
              </p>
              <div className="mb-3 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {approveUrl}
              </div>
              <div className="flex gap-2">
                <button onClick={copyLink} className="btn-primary flex-1">
                  {copied ? '¡Copiado!' : 'Copiar link'}
                </button>
                <button onClick={() => setOpen(false)} className="btn-secondary">
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm font-medium text-slate-900">
                ¿Por qué canal se lo enviamos?
              </p>
              <div className="space-y-2">
                <button
                  disabled={pending || !whatsappConnected || !clientHasPhone}
                  onClick={() => handleSend('whatsapp')}
                  className="btn-primary w-full"
                  title={
                    !whatsappConnected
                      ? 'Conecta WhatsApp en Configuración'
                      : !clientHasPhone
                        ? 'El cliente no tiene WhatsApp registrado'
                        : undefined
                  }
                >
                  {pending ? 'Enviando…' : '💬 WhatsApp'}
                </button>
                {!whatsappConnected && (
                  <p className="text-center text-xs text-slate-400">
                    WhatsApp no está conectado aún
                  </p>
                )}
                <button
                  disabled={pending}
                  onClick={() => handleSend('web')}
                  className="btn-secondary w-full"
                >
                  {pending ? 'Generando…' : '🔗 Generar link web de aprobación'}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
