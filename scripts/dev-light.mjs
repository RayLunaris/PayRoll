#!/usr/bin/env node

/**
 * PayrollPro Lightweight Dev Runner
 * Dioptimalkan untuk sistem dengan RAM 8GB (atau di bawahnya).
 * 
 * Penggunaan:
 *   node scripts/dev-light.mjs             (Mode Interaktif)
 *   node scripts/dev-light.mjs core        (Web + Gateway + Auth + Employee)
 *   node scripts/dev-light.mjs payroll     (Core + Payroll Service)
 *   node scripts/dev-light.mjs attendance  (Core + Attendance + Shift)
 *   node scripts/dev-light.mjs leave       (Core + Leave Service)
 *   node scripts/dev-light.mjs social      (Core + Social + WebSocket)
 *   node scripts/dev-light.mjs backend     (Gateway + Auth + Employee, tanpa Web)
 *   node scripts/dev-light.mjs all         (Semua 10 service dengan limit memori aktif)
 */

import { spawn, execSync } from 'node:child_process';
import readline from 'node:readline';
import process from 'node:process';

// Konfigurasi service yang tersedia
const SERVICES = {
  gateway: {
    name: 'api-gateway',
    filter: '@payrollpro/api-gateway',
    color: '\x1b[36m', // Cyan
    port: 3001,
    maxMemory: 256,
  },
  auth: {
    name: 'auth-service',
    filter: '@payrollpro/auth-service',
    color: '\x1b[32m', // Green
    port: 3010,
    maxMemory: 256,
  },
  employee: {
    name: 'employee-service',
    filter: '@payrollpro/employee-service',
    color: '\x1b[33m', // Yellow
    port: 3011,
    maxMemory: 256,
  },
  payroll: {
    name: 'payroll-service',
    filter: '@payrollpro/payroll-service',
    color: '\x1b[34m', // Blue
    port: 3012,
    maxMemory: 256,
  },
  attendance: {
    name: 'attendance-service',
    filter: '@payrollpro/attendance-service',
    color: '\x1b[35m', // Magenta
    port: 3013,
    maxMemory: 256,
  },
  leave: {
    name: 'leave-service',
    filter: '@payrollpro/leave-service',
    color: '\x1b[90m', // Gray
    port: 3014,
    maxMemory: 256,
  },
  social: {
    name: 'social-service',
    filter: '@payrollpro/social-service',
    color: '\x1b[94m', // Bright Blue
    port: 3015,
    maxMemory: 256,
  },
  shift: {
    name: 'shift-service',
    filter: '@payrollpro/shift-service',
    color: '\x1b[93m', // Bright Yellow
    port: 3016,
    maxMemory: 256,
  },
  ws: {
    name: 'websocket',
    filter: '@payrollpro/websocket',
    color: '\x1b[96m', // Bright Cyan
    port: 3002,
    maxMemory: 256,
  },
  web: {
    name: 'web (Next.js)',
    filter: '@payrollpro/web',
    color: '\x1b[95m', // Bright Magenta
    port: 3000,
    maxMemory: 768,
  },
};

const PRESETS = {
  core: {
    name: 'Core Services (Web + Gateway + Auth + Employee)',
    desc: 'Paling hemat RAM (~800MB). Cukup untuk auth, dashboard, data pegawai.',
    services: ['gateway', 'auth', 'employee', 'web'],
  },
  payroll: {
    name: 'Payroll Focus (Core + Payroll Service)',
    desc: 'Untuk pengerjaan penggajian, slip gaji, kasbon, BPJS, PPh21.',
    services: ['gateway', 'auth', 'employee', 'payroll', 'web'],
  },
  attendance: {
    name: 'Attendance Focus (Core + Attendance + Shift)',
    desc: 'Untuk pengerjaan absensi GPS/selfie & pengaturan jadwal shift.',
    services: ['gateway', 'auth', 'employee', 'attendance', 'shift', 'web'],
  },
  leave: {
    name: 'Leave Focus (Core + Leave Service)',
    desc: 'Untuk pengerjaan pengajuan cuti, approval, dan kalender.',
    services: ['gateway', 'auth', 'employee', 'leave', 'web'],
  },
  social: {
    name: 'Social & Chat Focus (Core + Social + WebSocket)',
    desc: 'Untuk pengerjaan feed, postingan, direct chat, pengumuman.',
    services: ['gateway', 'auth', 'employee', 'social', 'ws', 'web'],
  },
  backend: {
    name: 'Backend Core Only (Gateway + Auth + Employee, Tanpa Web)',
    desc: 'Ultra ringan (~250MB RAM). Ideal saat testing API via Postman/curl.',
    services: ['gateway', 'auth', 'employee'],
  },
  all: {
    name: 'All 10 Services (Dengan Limit Memori V8 Aktif)',
    desc: 'Menjalankan semua service tetapi dibatasi memori agar tidak OOM.',
    services: Object.keys(SERVICES),
  },
};

const RESET_COLOR = '\x1b[0m';
const BOLD = '\x1b[1m';
const childProcesses = [];
let isShuttingDown = false;

function ensureDockerServices() {
  console.log(`${BOLD}[System] Memastikan PostgreSQL & Redis berjalan...${RESET_COLOR}`);
  try {
    execSync('docker start payrollpro-postgres payrollpro-redis 2>/dev/null || docker compose up -d postgres redis', {
      stdio: 'ignore',
    });
    console.log(`${BOLD}[System] PostgreSQL & Redis siap.${RESET_COLOR}\n`);
  } catch (err) {
    console.warn(`\x1b[33m[Warning] Gagal memastikan Docker container, pastikan database & redis lokal sudah berjalan.\x1b[0m\n`);
  }
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (childProcesses.length === 0) return;
  console.log(`\n${BOLD}[System] Menghentikan semua service...${RESET_COLOR}`);
  for (const cp of childProcesses) {
    try {
      if (cp.pid) {
        process.kill(-cp.pid, 'SIGINT');
      }
    } catch (_) {
      try {
        cp.kill('SIGINT');
      } catch (_) {}
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

function spawnSingleService(key, restartCount = 0) {
  const s = SERVICES[key];
  if (!s) return;
  const prefix = `${s.color}[${s.name}]${RESET_COLOR} `;

  const child = spawn('pnpm', ['--filter', s.filter, 'dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true,
    env: {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${s.maxMemory}`,
    },
  });

  childProcesses.push(child);

  const pipeOutput = (stream, isError = false) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.trim().length > 0) {
          const outStream = isError ? process.stderr : process.stdout;
          outStream.write(`${prefix}${line}\n`);
        }
      }
    });
  };

  pipeOutput(child.stdout, false);
  pipeOutput(child.stderr, true);

  child.on('error', (err) => {
    console.error(`${prefix}\x1b[31mError: ${err.message}${RESET_COLOR}`);
  });

  child.on('close', (code) => {
    const idx = childProcesses.indexOf(child);
    if (idx !== -1) childProcesses.splice(idx, 1);

    if (!isShuttingDown && code !== 0 && code !== null) {
      console.log(`${prefix}\x1b[31mBerhenti dengan exit code ${code}.${RESET_COLOR}`);
      if (restartCount < 3) {
        console.log(`${prefix}\x1b[33mMemulai ulang service dalam 1 detik (percobaan ${restartCount + 1}/3)...${RESET_COLOR}`);
        setTimeout(() => {
          if (!isShuttingDown) {
            spawnSingleService(key, restartCount + 1);
          }
        }, 1000);
      }
    }
  });
}

async function startServices(selectedKeys) {
  ensureDockerServices();

  const uniqueKeys = [...new Set(selectedKeys)].filter((k) => SERVICES[k]);
  if (uniqueKeys.length === 0) {
    console.error('Tidak ada service valid yang dipilih.');
    process.exit(1);
  }

  // Prioritas urutan: auth & gateway jalan terlebih dahulu, web terakhir
  const priorityOrder = ['auth', 'gateway', 'employee', 'payroll', 'attendance', 'leave', 'shift', 'social', 'ws', 'web'];
  uniqueKeys.sort((a, b) => {
    const ai = priorityOrder.indexOf(a);
    const bi = priorityOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  console.log(`${BOLD}====================================================${RESET_COLOR}`);
  console.log(`${BOLD} Menjalankan ${uniqueKeys.length} Service (Lightweight Mode)${RESET_COLOR}`);
  console.log(`${BOLD}====================================================${RESET_COLOR}`);

  for (const key of uniqueKeys) {
    const s = SERVICES[key];
    console.log(`  ${s.color}● ${s.name.padEnd(22)}${RESET_COLOR} -> Port: ${s.port} | Max Heap: ${s.maxMemory}MB`);
  }
  console.log(`${BOLD}====================================================${RESET_COLOR}\n`);

  for (let i = 0; i < uniqueKeys.length; i++) {
    const key = uniqueKeys[i];
    spawnSingleService(key);
    // Beri jeda 150ms agar proses tidak berebut I/O CPU pada milidetik yang sama
    if (i < uniqueKeys.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

async function showInteractiveMenu() {
  console.log(`\n${BOLD}======================================================${RESET_COLOR}`);
  console.log(`${BOLD}    PayrollPro - Lightweight Development Runner       ${RESET_COLOR}`);
  console.log(`${BOLD}    Optimasi Monorepo untuk RAM 8GB                   ${RESET_COLOR}`);
  console.log(`${BOLD}======================================================${RESET_COLOR}\n`);
  console.log('Pilih preset modul yang ingin Anda kerjakan:\n');

  const presetList = Object.entries(PRESETS);
  presetList.forEach(([key, info], idx) => {
    console.log(`  ${BOLD}[${idx + 1}] ${info.name}${RESET_COLOR}`);
    console.log(`      \x1b[90m${info.desc}\x1b[0m`);
  });

  console.log(`  ${BOLD}[8] Custom Selection (Pilih sendiri)${RESET_COLOR}`);
  console.log(`  ${BOLD}[0] Batal / Keluar${RESET_COLOR}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`${BOLD}Pilihan Anda [1-8]: ${RESET_COLOR}`, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });

  if (answer === '0' || answer === '') {
    console.log('Dibatalkan.');
    process.exit(0);
  }

  const num = parseInt(answer, 10);
  if (num >= 1 && num <= presetList.length) {
    const selectedPreset = presetList[num - 1][1];
    startServices(selectedPreset.services);
  } else if (num === 8) {
    await showCustomSelection();
  } else {
    console.log('Pilihan tidak valid.');
    process.exit(1);
  }
}

async function showCustomSelection() {
  console.log(`\n${BOLD}Pilih service yang ingin dijalankan (pisahkan dengan koma atau spasi):${RESET_COLOR}`);
  const keys = Object.keys(SERVICES);
  keys.forEach((k, idx) => {
    console.log(`  [${idx + 1}] ${k} (${SERVICES[k].name})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`\n${BOLD}Masukkan nomor service (contoh: 1,2,3,10): ${RESET_COLOR}`, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });

  const indices = answer
    .split(/[\s,]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= keys.length);

  const selected = indices.map((idx) => keys[idx - 1]);
  if (selected.length === 0) {
    console.log('Tidak ada service yang dipilih.');
    process.exit(0);
  }

  startServices(selected);
}

// Entrypoint
const arg = process.argv[2]?.toLowerCase();
if (!arg) {
  showInteractiveMenu();
} else if (PRESETS[arg]) {
  startServices(PRESETS[arg].services);
} else {
  // Argument bisa berupa daftar nama service: "gateway auth employee web"
  const requested = process.argv.slice(2).map((s) => s.toLowerCase());
  const valid = requested.filter((r) => SERVICES[r]);
  if (valid.length > 0) {
    startServices(valid);
  } else {
    console.error(`Preset atau service "${arg}" tidak ditemukan.`);
    console.log(`Preset yang tersedia: ${Object.keys(PRESETS).join(', ')}`);
    console.log(`Service yang tersedia: ${Object.keys(SERVICES).join(', ')}`);
    process.exit(1);
  }
}
