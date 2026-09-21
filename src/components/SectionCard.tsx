import type { ReactNode } from "react";

export function SectionCard({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-b2b-purple/10 bg-b2b-card p-5 shadow-sm shadow-b2b-purple/5">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-b2b-ink/50">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
