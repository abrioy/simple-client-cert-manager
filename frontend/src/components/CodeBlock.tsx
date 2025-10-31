import { PropsWithChildren } from 'react';
import './CodeBlock.css';

type CodeBlockProps = PropsWithChildren<{
  label?: string;
}>;

export const CodeBlock = ({ label, children }: CodeBlockProps) => (
  <div className="code-block">
    {label ? <div className="code-block__label">{label}</div> : null}
    <pre>
      <code>{children}</code>
    </pre>
  </div>
);
