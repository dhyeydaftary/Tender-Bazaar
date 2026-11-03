import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Run a probe script in a fresh Node process with ONLY the given environment
 * (plus what the OS needs to start a process), so the parent's NODE_ENV,
 * secrets and URLs cannot leak in. Probes import the real modules, so this
 * exercises genuine startup and request paths rather than re-stated logic.
 */
export function runProbe(
  probe: string,
  env: Record<string, string | undefined>,
): { status: number | null; stdout: string; stderr: string; json: any } {
  const base: Record<string, string> = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec']) {
    const value = process.env[name];
    if (value !== undefined) base[name] = value;
  }
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined) base[name] = value;
  }

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', join(__dirname, probe)],
    { env: base, encoding: 'utf8', timeout: 60_000 },
  );

  const lastLine = (result.stdout ?? '').trim().split('\n').filter(Boolean).pop() ?? '';
  let json: any = null;
  try {
    json = JSON.parse(lastLine);
  } catch {
    json = null;
  }
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', json };
}
