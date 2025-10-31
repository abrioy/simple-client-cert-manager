import { AppLayout } from '../features/layout/AppLayout';
import { CertificatesView } from '../features/certificates/CertificatesView';

export const App = () => {
  return (
    <AppLayout>
      <CertificatesView />
    </AppLayout>
  );
};
