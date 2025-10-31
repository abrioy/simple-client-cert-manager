import { forwardRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import './TextField.css';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ id, label, error, className, ...props }, ref) => {
    const fieldId = id ?? props.name;

    return (
      <label className={clsx('text-field', className)} htmlFor={fieldId}>
        <span className="text-field__label">{label}</span>
        <input id={fieldId} ref={ref} className="text-field__input" {...props} />
        {error ? <span className="text-field__error">{error}</span> : null}
      </label>
    );
  }
);

TextField.displayName = 'TextField';
