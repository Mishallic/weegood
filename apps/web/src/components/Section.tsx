import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, subtitle, actions, children }: SectionProps) {
  return (
    <section className="section">
      <header className="section__header">
        <div className="section__title">
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
