'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    // El trigger handle_new_user crea la agencia + member owner
    // a partir de agency_name en los metadatos.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { agency_name: agencyName } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setNeedsConfirmation(true);
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="card p-8 text-center">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Revisa tu correo</h2>
        <p className="text-sm text-slate-500">
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para
          activar tu cuenta y entrar al dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h2 className="mb-6 text-lg font-semibold text-slate-900">Crea tu agencia</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="agencyName" className="label">
            Nombre de tu agencia
          </label>
          <input
            id="agencyName"
            type="text"
            required
            className="input"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Ej: Impulso Digital"
          />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@agencia.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
