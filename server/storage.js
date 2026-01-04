import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_FILE = path.join(DATA_DIR, 'certificates.json');

/**
 * Initialize storage
 */
async function initStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'certs'), { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify({ certificates: [] }, null, 2));
  }
}

/**
 * Read database
 */
async function readDB() {
  await initStorage();
  const data = await fs.readFile(DB_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * Write database
 */
async function writeDB(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

/**
 * Save certificate metadata
 */
export async function saveCertificate(certData) {
  const db = await readDB();
  db.certificates.push({
    id: certData.certId,
    email: certData.metadata.email,
    label: certData.metadata.label,
    createdAt: certData.metadata.createdAt,
    validityDays: certData.metadata.validityDays,
    hasPassword: certData.metadata.hasPassword,
    revoked: false,
    revokedAt: null
  });
  await writeDB(db);
}

/**
 * Get all certificates
 */
export async function getAllCertificates() {
  const db = await readDB();
  return db.certificates;
}

/**
 * Get certificate by ID
 */
export async function getCertificateById(id) {
  const db = await readDB();
  return db.certificates.find(cert => cert.id === id);
}

/**
 * Mark certificate as revoked
 */
export async function markCertificateRevoked(id) {
  const db = await readDB();
  const cert = db.certificates.find(cert => cert.id === id);
  if (cert) {
    cert.revoked = true;
    cert.revokedAt = new Date().toISOString();
    await writeDB(db);
    return true;
  }
  return false;
}
