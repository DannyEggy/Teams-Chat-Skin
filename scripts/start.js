#!/usr/bin/env node
// Cross-platform launcher for `npm start` / `npm run dev` (macOS + Windows).
// Strips ELECTRON_RUN_AS_NODE, which VS Code and some terminals set and which
// makes Electron run as plain Node, then starts the app from the project root.
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron'); // resolves to the Electron binary path

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (process.argv.includes('--dev')) env.TEAMS_DEBUG_PORT = env.TEAMS_DEBUG_PORT || '9333';

const child = spawn(electron, [path.join(__dirname, '..')], { stdio: 'inherit', env });
child.on('close', (code, signal) => process.exit(signal ? 1 : code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (!child.killed) child.kill(sig); });
}
