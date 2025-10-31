import { PropsWithChildren, ReactNode } from 'react';
import './Card.css';

type CardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
}>;

export const Card = ({ title, subtitle, action, children }: CardProps) => (
  <section className="card">
    <header className="card__header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="card__action">{action}</div> : null}
    </header>
    <div className="card__body">{children}</div>
  </section>
);
