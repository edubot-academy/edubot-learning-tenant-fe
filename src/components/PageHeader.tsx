import type { ReactNode } from 'react';

export function PageHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div className="min-w-0">
        {eyebrow ? <span className="ui-kicker">{eyebrow}</span> : null}
        <h1 className="mt-1 break-words text-3xl font-black leading-tight text-ui-text">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div> : null}
    </header>
  );
}
