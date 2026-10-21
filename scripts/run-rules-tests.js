#!/usr/bin/env node
import { spawn } from 'node:child_process';
import net from 'node:net';

function checkPort(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(port, host);
  });
}

async function main() {
  const isFirestoreUp = await checkPort(8180);
  const isDbUp = await checkPort(9000);

  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');

  const possibleJavaHomes = [
    process.env.JAVA_HOME,
    path.join(os.homedir(), '.jdks', 'openjdk-25.0.2'),
    '/usr/lib/jvm/java-21-openjdk-amd64',
    '/usr/lib/jvm/java-25-openjdk-amd64'
  ].filter(Boolean);

  const javaHome = possibleJavaHomes.find(p => fs.existsSync(p));
  const env = { ...process.env };
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${path.join(javaHome, 'bin')}:${process.env.PATH || ''}`;
  }

  if (isFirestoreUp && isDbUp) {
    console.log('==> Detected active Firebase Emulators (ports 8180 & 9000). Running rules tests directly...');
    env.FIRESTORE_EMULATOR_HOST = 'localhost:8180';
    env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000';
    const child = spawn('node', ['--test', 'rules-tests/*.test.js'], {
      stdio: 'inherit',
      env,
      shell: true
    });
    child.on('exit', code => process.exit(code ?? 0));
  } else {
    console.log('==> Starting isolated Firebase Emulators for rules tests...');
    const child = spawn('firebase', [
      'emulators:exec',
      '--only', 'firestore,database',
      '--project', 'demo-aurelia',
      'node --test rules-tests/*.test.js'
    ], {
      stdio: 'inherit',
      env,
      shell: true
    });
    child.on('exit', code => process.exit(code ?? 0));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
