import { PropsWithChildren } from 'react';
import { Container } from '../../components/Container';
import { PageHeader } from '../../components/PageHeader';

export const AppLayout = ({ children }: PropsWithChildren) => (
  <div className="app-layout">
    <PageHeader
      title="Simple Client Certificate Manager"
      description="Generate and revoke client certificates with a step-ca backend secured behind Docker."
    />
    <Container>{children}</Container>
  </div>
);
