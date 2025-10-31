import { PropsWithChildren } from 'react';
import './Container.css';

export const Container = ({ children }: PropsWithChildren) => (
  <div className="container">{children}</div>
);
