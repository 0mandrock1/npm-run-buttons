const { spawn, execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { promisify, stripVTControlCharacters } = require('node:util');

const exec = promisify(execFile);
const windows = process.platform === 'win32';

async function npmCommand() {
  if (!windows) return { executable: 'npm', args: [] };

  // Resolve the standard npm launcher, then invoke its JS entry point directly.
  const { stdout } = await exec('where.exe', ['npm.cmd'], { windowsHide: true })
    .catch(() => ({ stdout: '' }));
  for (const launcher of stdout.trim().split(/\r?\n/).filter(Boolean)) {
    const directory = path.dirname(launcher);
    const cli = path.join(directory, 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (!existsSync(cli)) continue;
    const node = path.join(directory, 'node.exe');
    return { executable: existsSync(node) ? node : 'node.exe', args: [cli] };
  }
  throw new Error('Install Node.js with npm and restart VS Code so npm is on PATH.');
}

function run({ executable, args }, cwd, name) {
  return spawn(executable, [...args, 'run', '--', name], {
    cwd,
    detached: !windows,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
  });
}

async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (windows) {
    await exec('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    process.kill(-child.pid, 'SIGTERM');
  }
}

function cleanOutput(chunk) {
  return stripVTControlCharacters(chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = { npmCommand, run, stop, cleanOutput };
