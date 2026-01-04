import { spawn } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const CERT_DIR = process.env.CERT_DIR || '/certs';
const DATA_DIR = process.env.DATA_DIR || '/data';
const ROOT_CERT = path.join(CERT_DIR, 'root.pem');
const INTERMEDIATE_CERT = path.join(CERT_DIR, 'intermediate.pem');
const INTERMEDIATE_KEY = path.join(CERT_DIR, 'intermediate-key.pem');

/**
 * Execute an OpenSSL command with optional stdin and return both the command string and result
 */
async function executeOpenSSL(args, description, stdinData = null) {
  const command = `openssl ${args.join(' ')}`;

  return new Promise((resolve) => {
    const proc = spawn('openssl', args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({
          command,
          description,
          success: true,
          output: stdout || stderr || 'Command completed successfully',
          data: stdout
        });
      } else {
        resolve({
          command,
          description,
          success: false,
          output: stderr || stdout || 'Command failed',
          stderr: stderr
        });
      }
    });

    if (stdinData) {
      proc.stdin.write(stdinData);
      proc.stdin.end();
    }
  });
}

/**
 * Generate a P12 bundle with client certificate (no temporary files)
 */
export async function generateClientCertificate(email, label, password = '') {
  const certId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const certPath = path.join(DATA_DIR, 'certs', certId);
  await fs.mkdir(certPath, { recursive: true });

  const commands = [];
  const validityDays = process.env.CERT_VALIDITY_DAYS || '180';

  // 1. Generate private key (to stdout)
  let result = await executeOpenSSL(
    ['genrsa', '2048'],
    'Generate 2048-bit RSA private key'
  );
  commands.push(result);
  if (!result.success) throw new Error('Failed to generate private key');
  const privateKey = result.data;

  // 2. Create CSR from private key (via stdin)
  const subject = `/CN=${email}/emailAddress=${email}`;
  result = await executeOpenSSL(
    ['req', '-new', '-key', '/dev/stdin', '-subj', subject],
    'Create Certificate Signing Request (CSR)',
    privateKey
  );
  commands.push(result);
  if (!result.success) throw new Error('Failed to create CSR');
  const csr = result.data;

  // 3. Ensure serial file exists
  const serialFile = path.join(DATA_DIR, 'serial.txt');
  try {
    await fs.access(serialFile);
  } catch {
    await fs.writeFile(serialFile, '1000\n');
  }

  // 4. Sign certificate with intermediate CA (CSR via stdin)
  result = await executeOpenSSL(
    [
      'x509', '-req',
      '-CA', INTERMEDIATE_CERT,
      '-CAkey', INTERMEDIATE_KEY,
      '-CAserial', serialFile,
      '-days', validityDays,
      '-sha256'
    ],
    `Sign certificate valid for ${validityDays} days`,
    csr
  );
  commands.push(result);
  if (!result.success) throw new Error('Failed to sign certificate');
  const certificate = result.data;

  // 5. Save certificate for revocation purposes
  const certFile = path.join(certPath, 'client-cert.pem');
  await fs.writeFile(certFile, certificate);

  // 6. Read intermediate cert for P12 bundle
  const intermediateCert = await fs.readFile(INTERMEDIATE_CERT, 'utf8');

  // 7. Create temporary files only for P12 creation (OpenSSL pkcs12 requires files)
  const tmpKeyFile = path.join(certPath, 'tmp-key.pem');
  const tmpCertFile = path.join(certPath, 'tmp-cert.pem');
  const tmpIntFile = path.join(certPath, 'tmp-int.pem');
  const p12File = path.join(certPath, 'client.p12');

  await fs.writeFile(tmpKeyFile, privateKey);
  await fs.writeFile(tmpCertFile, certificate);
  await fs.writeFile(tmpIntFile, intermediateCert);

  const p12Args = [
    'pkcs12', '-export',
    '-out', p12File,
    '-inkey', tmpKeyFile,
    '-in', tmpCertFile,
    '-certfile', tmpIntFile
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

  // Clean up temporary files immediately
  await fs.unlink(tmpKeyFile);
  await fs.unlink(tmpCertFile);
  await fs.unlink(tmpIntFile);

  if (!result.success) throw new Error('Failed to create P12 bundle');

  // Read the P12 file
  const p12Data = await fs.readFile(p12File);

  // Get certificate details (cert via stdin)
  result = await executeOpenSSL(
    ['x509', '-noout', '-text'],
    'Display certificate details',
    certificate
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
  const configFile = path.join(DATA_DIR, 'openssl-crl.cnf');
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

  // Ensure OpenSSL config exists (persistent, not temporary)
  try {
    await fs.access(configFile);
  } catch {
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
  }

  // Get cert info
  try {
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
  const crlNumberFile = path.join(DATA_DIR, 'crlnumber.txt');
  const indexFile = path.join(DATA_DIR, 'index.txt');
  const configFile = path.join(DATA_DIR, 'openssl-crl.cnf');
  const commands = [];

  try {
    const crlData = await fs.readFile(crlFile, 'utf8');
    const result = await executeOpenSSL(
      ['crl', '-noout', '-text'],
      'Display CRL contents',
      crlData
    );
    commands.push(result);

    return { crlData, commands };
  } catch (error) {
    // No CRL yet - generate an empty one
    await fs.mkdir(DATA_DIR, { recursive: true });

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

    try {
      await fs.access(configFile);
    } catch {
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
    }

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
