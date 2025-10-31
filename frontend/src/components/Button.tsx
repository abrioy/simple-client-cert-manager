import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import './Button.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export const Button = ({ className, variant = 'primary', ...props }: ButtonProps) => (
  <button className={clsx('button', `button--${variant}`, className)} {...props} />
);
