export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
            B
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Briefy</h1>
          <p className="mt-1 text-sm text-slate-500">
            El agente de contenido para agencias
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
