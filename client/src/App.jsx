import { useState, useEffect } from 'react';
import { getUser, generateCertificate, getCertificates, revokeCertificate, getCRL } from './api';

function CommandOutput({ commands }) {
  if (!commands || commands.length === 0) return null;

  return (
    <div>
      <h2>Command History</h2>
      {commands.map((cmd, idx) => (
        <div key={idx} className={`command-output ${cmd.success ? '' : 'error'}`}>
          <div className="description">{cmd.description}</div>
          <div className="command">$ {cmd.command}</div>
          <div className="output">{cmd.output}</div>
        </div>
      ))}
    </div>
  );
}

function CertificateForm({ onGenerate, disabled }) {
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate(label, usePassword ? password : '');
    setLabel('');
    setPassword('');
    setUsePassword(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Generate New Certificate</h2>
      <div className="form-group">
        <label htmlFor="label">Certificate Label *</label>
        <input
          type="text"
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., My Laptop, Work Device, etc."
          required
          disabled={disabled}
        />
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={usePassword}
            onChange={(e) => setUsePassword(e.target.checked)}
            disabled={disabled}
          />
          {' '}Protect P12 bundle with password
        </label>
      </div>
      {usePassword && (
        <div className="form-group">
          <label htmlFor="password">P12 Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password for P12 file"
            disabled={disabled}
          />
        </div>
      )}
      <button type="submit" disabled={disabled || !label}>
        {disabled ? 'Generating...' : 'Generate Certificate'}
      </button>
    </form>
  );
}

function CertificateList({ certificates, onRevoke, onRefresh, loading }) {
  const [revokingId, setRevokingId] = useState(null);

  const handleRevoke = async (certId) => {
    if (!confirm('Are you sure you want to revoke this certificate? This action cannot be undone.')) {
      return;
    }

    setRevokingId(certId);
    try {
      await onRevoke(certId);
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return <div className="loading">Loading certificates...</div>;
  }

  if (certificates.length === 0) {
    return (
      <div>
        <h2>Your Certificates</h2>
        <p>No certificates yet. Generate your first certificate above.</p>
      </div>
    );
  }

  return (
    <div className="cert-list">
      <h2>Your Certificates</h2>
      {certificates.map((cert) => (
        <div key={cert.id} className={`cert-item ${cert.revoked ? 'revoked' : ''}`}>
          <div className="cert-item-header">
            <div>
              <div className="cert-label">{cert.label}</div>
              <div className="cert-meta">
                Created: {new Date(cert.createdAt).toLocaleString()}
                {' | '}
                Valid for: {cert.validityDays} days
                {' | '}
                Password: {cert.hasPassword ? 'Yes' : 'No'}
              </div>
              {cert.revoked && (
                <div className="cert-meta" style={{ color: '#e74c3c', marginTop: '5px' }}>
                  Revoked: {new Date(cert.revokedAt).toLocaleString()}
                </div>
              )}
            </div>
            <div>
              {cert.revoked ? (
                <span className="badge revoked">Revoked</span>
              ) : (
                <>
                  <span className="badge active">Active</span>
                  {' '}
                  <button
                    className="danger"
                    onClick={() => handleRevoke(cert.id)}
                    disabled={revokingId === cert.id}
                  >
                    {revokingId === cert.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [commands, setCommands] = useState([]);
  const [showCRL, setShowCRL] = useState(false);
  const [crlData, setCrlData] = useState(null);

  useEffect(() => {
    loadUser();
    loadCertificates();
  }, []);

  async function loadUser() {
    try {
      const userData = await getUser();
      setUser(userData);
    } catch (err) {
      setError('Failed to load user info: ' + err.message);
    }
  }

  async function loadCertificates() {
    try {
      setLoading(true);
      const data = await getCertificates();
      setCertificates(data.certificates);
    } catch (err) {
      setError('Failed to load certificates: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(label, password) {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      setCommands([]);

      const result = await generateCertificate(label, password);

      // Show commands
      setCommands(result.commands);

      // Download P12 file
      const blob = new Blob([Uint8Array.from(atob(result.p12), c => c.charCodeAt(0))], {
        type: 'application/x-pkcs12'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.replace(/[^a-z0-9]/gi, '_')}.p12`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Certificate "${label}" generated successfully and downloaded!`);

      // Refresh certificate list
      await loadCertificates();
    } catch (err) {
      setError('Failed to generate certificate: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(certId) {
    try {
      setError(null);
      setSuccess(null);
      setCommands([]);

      const result = await revokeCertificate(certId);

      // Show commands
      setCommands(result.commands);
      setSuccess('Certificate revoked successfully!');

      // Refresh certificate list
      await loadCertificates();
    } catch (err) {
      setError('Failed to revoke certificate: ' + err.message);
    }
  }

  async function handleShowCRL() {
    try {
      setError(null);
      setCommands([]);

      const result = await getCRL();
      setCrlData(result.crl);
      setCommands(result.commands);
      setShowCRL(true);
    } catch (err) {
      setError('Failed to get CRL: ' + err.message);
    }
  }

  return (
    <div className="container">
      <h1>Client Certificate Manager</h1>

      {user && (
        <div className="user-info">
          Logged in as: <strong>{user.email}</strong>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <CertificateForm onGenerate={handleGenerate} disabled={generating} />

      {commands.length > 0 && <CommandOutput commands={commands} />}

      <CertificateList
        certificates={certificates}
        onRevoke={handleRevoke}
        onRefresh={loadCertificates}
        loading={loading}
      />

      <div style={{ marginTop: '30px' }}>
        <h2>Certificate Revocation List (CRL)</h2>
        <button onClick={handleShowCRL}>View Current CRL</button>
        {showCRL && crlData && (
          <div className="command-output" style={{ marginTop: '15px' }}>
            <div className="description">Certificate Revocation List</div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>{crlData}</pre>
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '4px', fontSize: '13px' }}>
        <h3 style={{ marginBottom: '10px' }}>About</h3>
        <p>
          This application generates client certificates signed by your intermediate CA.
          All certificate operations use OpenSSL CLI and are executed on the server.
          Commands and their outputs are displayed above for transparency.
        </p>
        <p style={{ marginTop: '10px' }}>
          Certificates are issued in P12 format for easy installation on client devices.
          Revoked certificates are added to the Certificate Revocation List (CRL).
        </p>
      </div>
    </div>
  );
}

export default App;
