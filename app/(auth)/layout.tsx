export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-2xl font-black italic text-white shadow-sm">
            B
          </div>
          <h1 className="text-2xl font-extrabold uppercase tracking-wide text-slate-900">
            Bitélica <span className="text-brand-600">Briefs</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            El agente de contenido para agencias
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
