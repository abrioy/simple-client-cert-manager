const API_BASE = '/api';

export async function getUser() {
  const response = await fetch(`${API_BASE}/user`);
  if (!response.ok) throw new Error('Failed to get user info');
  return response.json();
}

export async function generateCertificate(label, password) {
  const response = await fetch(`${API_BASE}/certificates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, password })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate certificate');
  }
  return response.json();
}

export async function getCertificates() {
  const response = await fetch(`${API_BASE}/certificates`);
  if (!response.ok) throw new Error('Failed to get certificates');
  return response.json();
}

export async function revokeCertificate(certId) {
  const response = await fetch(`${API_BASE}/certificates/${certId}/revoke`, {
    method: 'POST'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke certificate');
  }
  return response.json();
}

export async function getCRL() {
  const response = await fetch(`${API_BASE}/crl`);
  if (!response.ok) throw new Error('Failed to get CRL');
  return response.json();
}
