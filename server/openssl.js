import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const CERT_DIR = process.env.CERT_DIR || '/certs';
const DATA_DIR = process.env.DATA_DIR || '/data';
const ROOT_CERT = path.join(CERT_DIR, 'root.pem');
const INTERMEDIATE_CERT = path.join(CERT_DIR, 'intermediate.pem');
const INTERMEDIATE_KEY = path.join(CERT_DIR, 'intermediate-key.pem');

/**
 * Execute an OpenSSL command and return both the command string and result
 */
async function executeOpenSSL(args, description) {
  const command = `openssl ${args.join(' ')}`;
  try {
    const { stdout, stderr } = await execFileAsync('openssl', args);
    return {
      command,
      description,
      success: true,
      output: stdout || stderr || 'Command completed successfully'
    };
  } catch (error) {
    return {
      command,
      description,
      success: false,
      output: error.message,
      stderr: error.stderr
    };
  }
}

/**
 * Generate a P12 bundle with client certificate
 */
export async function generateClientCertificate(email, label, password = '') {
  const certId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const certPath = path.join(DATA_DIR, 'certs', certId);
  await fs.mkdir(certPath, { recursive: true });

  const keyFile = path.join(certPath, 'client-key.pem');
  const csrFile = path.join(certPath, 'client.csr');
  const certFile = path.join(certPath, 'client-cert.pem');
  const p12File = path.join(certPath, 'client.p12');
  const chainFile = path.join(certPath, 'chain.pem');

  const commands = [];

  // 1. Generate private key
  let result = await executeOpenSSL(
    ['genrsa', '-out', keyFile, '2048'],
    'Generate 2048-bit RSA private key'
  );
  commands.push(result);
  if (!result.success) throw new Error('Failed to generate private key');

  // 2. Create CSR
  const subject = `/CN=${email}/emailAddress=${email}`;
  result = await executeOpenSSL(
    ['req', '-new', '-key', keyFile, '-out', csrFile, '-subj', subject],
    'Create Certificate Signing Request (CSR)'
  );
  commands.push(result);
  if (!result.success) throw new Error('Failed to create CSR');

  // 3. Sign certificate with intermediate CA
  const validityDays = process.env.CERT_VALIDITY_DAYS || '180'; // 6 months default
  const serialFile = path.join(DATA_DIR, 'serial.txt');

  // Ensure serial file exists
  try {
    await fs.access(serialFile);
  } catch {
    await fs.writeFile(serialFile, '1000\n');
  }

  result = await executeOpenSSL(
    [
      'x509', '-req',
      '-in', csrFile,
      '-CA', INTERMEDIATE_CERT,
      '-CAkey', INTERMEDIATE_KEY,
      '-CAserial', serialFile,
      '-out', certFile,
      '-days', validityDays,
      '-sha256'
    ],
    `Sign certificate valid for ${validityDays} days`
  );
  commands.push(result);
  if (!result.success) throw new Error('Failed to sign certificate');

  // 4. Create certificate chain (client cert + intermediate + root)
  const clientCert = await fs.readFile(certFile, 'utf8');
  const intermediateCert = await fs.readFile(INTERMEDIATE_CERT, 'utf8');
  const rootCert = await fs.readFile(ROOT_CERT, 'utf8');
  await fs.writeFile(chainFile, `${clientCert}\n${intermediateCert}\n${rootCert}`);

  // 5. Create P12 bundle
  const p12Args = [
    'pkcs12', '-export',
    '-out', p12File,
    '-inkey', keyFile,
    '-in', certFile,
    '-certfile', INTERMEDIATE_CERT
  ];

  if (password) {
    p12Args.push('-passout', `pass:${password}`);
  } else {
    p12Args.push('-passout', 'pass:');
  }

  result = await executeOpenSSL(
    p12Args,
    password ? 'Create password-protected P12 bundle' : 'Create P12 bundle (no password)'
  );
  commands.push(result);
  if (!result.success) throw new Error('Failed to create P12 bundle');

  // Read the P12 file
  const p12Data = await fs.readFile(p12File);

  // Get certificate details
  result = await executeOpenSSL(
    ['x509', '-in', certFile, '-noout', '-text'],
    'Display certificate details'
  );
  commands.push(result);

  return {
    certId,
    p12Data,
    commands,
    metadata: {
      email,
      label,
      createdAt: new Date().toISOString(),
      validityDays,
      hasPassword: !!password
    }
  };
}

/**
 * Revoke a certificate by adding it to the CRL
 */
export async function revokeCertificate(certId) {
  const certPath = path.join(DATA_DIR, 'certs', certId);
  const certFile = path.join(certPath, 'client-cert.pem');
  const crlFile = path.join(DATA_DIR, 'crl.pem');
  const crlNumberFile = path.join(DATA_DIR, 'crlnumber.txt');
  const indexFile = path.join(DATA_DIR, 'index.txt');
  const commands = [];

  // Ensure CRL infrastructure exists
  try {
    await fs.access(crlNumberFile);
  } catch {
    await fs.writeFile(crlNumberFile, '1000\n');
  }

  try {
    await fs.access(indexFile);
  } catch {
    await fs.writeFile(indexFile, '');
  }

  // Create a temporary OpenSSL config for CRL
  const configFile = path.join(DATA_DIR, 'openssl-crl.cnf');
  const config = `
[ ca ]
default_ca = CA_default

[ CA_default ]
database = ${indexFile}
crlnumber = ${crlNumberFile}
default_crl_days = 30
default_md = sha256
`;
  await fs.writeFile(configFile, config);

  // Add cert to index if not already there
  try {
    const certData = await fs.readFile(certFile, 'utf8');
    const result = await executeOpenSSL(
      ['x509', '-in', certFile, '-noout', '-serial', '-subject'],
      'Get certificate serial and subject'
    );
    commands.push(result);
  } catch (error) {
    // Certificate file not found - already deleted or never existed
  }

  // Revoke the certificate
  let result = await executeOpenSSL(
    [
      'ca', '-revoke', certFile,
      '-keyfile', INTERMEDIATE_KEY,
      '-cert', INTERMEDIATE_CERT,
      '-config', configFile
    ],
    'Revoke certificate'
  );
  commands.push(result);

  // Generate updated CRL
  result = await executeOpenSSL(
    [
      'ca', '-gencrl',
      '-keyfile', INTERMEDIATE_KEY,
      '-cert', INTERMEDIATE_CERT,
      '-out', crlFile,
      '-config', configFile
    ],
    'Generate updated Certificate Revocation List (CRL)'
  );
  commands.push(result);

  return { commands };
}

/**
 * Get the current CRL
 */
export async function getCRL() {
  const crlFile = path.join(DATA_DIR, 'crl.pem');
  const commands = [];

  try {
    const crlData = await fs.readFile(crlFile, 'utf8');
    const result = await executeOpenSSL(
      ['crl', '-in', crlFile, '-noout', '-text'],
      'Display CRL contents'
    );
    commands.push(result);

    return { crlData, commands };
  } catch (error) {
    // No CRL yet - generate an empty one
    const crlNumberFile = path.join(DATA_DIR, 'crlnumber.txt');
    const indexFile = path.join(DATA_DIR, 'index.txt');

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(crlNumberFile, '1000\n');
    await fs.writeFile(indexFile, '');

    const configFile = path.join(DATA_DIR, 'openssl-crl.cnf');
    const config = `
[ ca ]
default_ca = CA_default

[ CA_default ]
database = ${indexFile}
crlnumber = ${crlNumberFile}
default_crl_days = 30
default_md = sha256
`;
    await fs.writeFile(configFile, config);

    const result = await executeOpenSSL(
      [
        'ca', '-gencrl',
        '-keyfile', INTERMEDIATE_KEY,
        '-cert', INTERMEDIATE_CERT,
        '-out', crlFile,
        '-config', configFile
      ],
      'Generate initial empty CRL'
    );
    commands.push(result);

    const crlData = await fs.readFile(crlFile, 'utf8');
    return { crlData, commands };
  }
}
