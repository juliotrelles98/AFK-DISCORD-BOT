import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Ensure Homebrew and standard paths are in PATH
process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ''}`;

let whisperProc = null;
let botProc = null;
let isShuttingDown = false;

function log(source, message) {
  console.log(`[${source}] ${message}`);
}

function checkWhisperHealth(url = 'http://127.0.0.1:8787/health') {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForWhisper(maxRetries = 30, delayMs = 1000) {
  log('LAUNCHER', '⏳ Esperando a que el servidor Whisper esté listo en http://127.0.0.1:8787...');
  for (let i = 0; i < maxRetries; i++) {
    if (isShuttingDown) return false;
    const isReady = await checkWhisperHealth();
    if (isReady) {
      log('LAUNCHER', '✅ Servidor Faster-Whisper listo y saludable.');
      return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  log('LAUNCHER', '⚠️ Tiempo de espera agotado para el servidor Whisper.');
  return false;
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('LAUNCHER', '🛑 Deteniendo todos los servicios (Whisper + Bot Discord)...');

  if (botProc) {
    try {
      botProc.kill('SIGTERM');
    } catch {}
    botProc = null;
  }

  if (whisperProc) {
    try {
      whisperProc.kill('SIGTERM');
    } catch {}
    whisperProc = null;
  }

  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);
process.on('exit', cleanup);

async function main() {
  log('LAUNCHER', '🚀 Iniciando servicios del DJ Voice Bot para Quay...');

  // 1. Iniciar servidor Whisper Python usando el Python donde están instalados los módulos
  log('LAUNCHER', '1️⃣ Iniciando servidor Faster-Whisper (Python)...');
  whisperProc = spawn('/usr/bin/python3', ['python/whisper_server.py'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  whisperProc.on('exit', (code) => {
    if (!isShuttingDown) {
      log('LAUNCHER', `⚠️ El servidor Whisper se cerró (código ${code})`);
      cleanup();
    }
  });

  // 2. Esperar a que Whisper responda en /health
  await waitForWhisper();

  if (isShuttingDown) return;

  // 3. Iniciar Bot de Discord (TypeScript)
  log('LAUNCHER', '2️⃣ Iniciando Bot de Discord (TypeScript)...');
  botProc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  botProc.on('exit', (code) => {
    if (!isShuttingDown) {
      log('LAUNCHER', `⚠️ El Bot de Discord se cerró (código ${code})`);
      cleanup();
    }
  });
}

main().catch((err) => {
  console.error('[LAUNCHER] Error fatal iniciando servicios:', err);
  cleanup();
});
