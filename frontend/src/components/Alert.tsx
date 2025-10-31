import { PropsWithChildren } from 'react';
import clsx from 'clsx';
import './Alert.css';

type AlertProps = PropsWithChildren<{
  variant?: 'info' | 'success' | 'error';
  title?: string;
}>;

export const Alert = ({ variant = 'info', title, children }: AlertProps) => (
  <div className={clsx('alert', `alert--${variant}`)}>
    {title ? <strong>{title}</strong> : null}
    <span>{children}</span>
  </div>
);
