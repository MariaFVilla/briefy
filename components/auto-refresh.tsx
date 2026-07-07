'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Refresca la página cada pocos segundos mientras algo se está generando
// en el backend (el producer corre en Supabase, no en Vercel).
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
