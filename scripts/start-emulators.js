#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
  console.log(`==> Using Java: ${javaHome}`);
}

const child = spawn('firebase', ['emulators:start', '--project', 'demo-aurelia', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: true
});

child.on('exit', code => process.exit(code ?? 0));
