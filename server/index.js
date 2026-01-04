import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateClientCertificate, revokeCertificate, getCRL } from './openssl.js';
import {
  saveCertificate,
  getAllCertificates,
  getCertificateById,
  markCertificateRevoked
} from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from the client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// API Routes

/**
 * GET /api/user - Get user info from forward auth header
 */
app.get('/api/user', (req, res) => {
  const email = req.headers['x-forwarded-email'] || 'dev@localhost';
  res.json({ email });
});

/**
 * POST /api/certificates - Generate a new client certificate
 */
app.post('/api/certificates', async (req, res) => {
  try {
    const email = req.headers['x-forwarded-email'] || 'dev@localhost';
    const { label, password } = req.body;

    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'Label is required' });
    }

    // Generate certificate
    const result = await generateClientCertificate(email, label, password);

    // Save metadata to storage
    await saveCertificate(result);

    // Return P12 bundle and command history
    res.json({
      certId: result.certId,
      p12: result.p12Data.toString('base64'),
      commands: result.commands,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/certificates - List all certificates
 */
app.get('/api/certificates', async (req, res) => {
  try {
    const certificates = await getAllCertificates();
    res.json({ certificates });
  } catch (error) {
    console.error('Error listing certificates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/certificates/:id/revoke - Revoke a certificate
 */
app.post('/api/certificates/:id/revoke', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if certificate exists
    const cert = await getCertificateById(id);
    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    if (cert.revoked) {
      return res.status(400).json({ error: 'Certificate already revoked' });
    }

    // Revoke certificate
    const result = await revokeCertificate(id);

    // Mark as revoked in storage
    await markCertificateRevoked(id);

    res.json({
      success: true,
      commands: result.commands
    });
  } catch (error) {
    console.error('Error revoking certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/crl - Get current Certificate Revocation List
 */
app.get('/api/crl', async (req, res) => {
  try {
    const result = await getCRL();
    res.json({
      crl: result.crlData,
      commands: result.commands
    });
  } catch (error) {
    console.error('Error getting CRL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
