import type { ReactNode } from "react";

export function AdminSection({ id, title, description, action, children }: {
  id: string; title: string; description: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-[#e9e7f4] bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
