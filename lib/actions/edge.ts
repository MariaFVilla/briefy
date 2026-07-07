// Invocación de Edge Functions desde server actions (solo servidor).
// Usa el service role key: el control de acceso ya se validó vía RLS
// en la acción que llama.

export async function invokeEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Edge function ${name} falló (${res.status})`
    );
  }
  return data as T;
}
