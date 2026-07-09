import { redirect } from 'next/navigation';
import { getCurrentAgency } from '@/lib/data/agency';
import { SidebarNav } from '@/components/sidebar-nav';
import { SignOutButton } from '@/components/signout-button';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentAgency();
  if (!current) redirect('/login');
  const { agency } = current;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-60 flex-col border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: agency.brand_color || '#F01263' }}
          >
            {agency.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {agency.name}
            </p>
            <p className="text-xs capitalize text-slate-400">Plan {agency.plan}</p>
          </div>
        </div>
        <SidebarNav />
        <div className="mt-auto border-t border-slate-100 pt-4">
          <SignOutButton />
          <p className="mt-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Bitélica <span className="text-brand-400">Briefs</span>
          </p>
        </div>
      </aside>
      <main className="ml-60 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
