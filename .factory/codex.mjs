import { spawnSync } from 'node:child_process';
import { openSync, readFileSync, closeSync } from 'node:fs';
const role = process.argv[2];
if (!['plan', 'build', 'review'].includes(role)) throw new Error('Invalid agent role');
const root = process.env.RUNNER_TEMP;
const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'CODEX_HOME', 'DATABASE_URL', 'NEXT_TELEMETRY_DISABLED', 'FACTORY_BASE_SHA', 'CI'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
const destination = role === 'review' ? `${root}/review.json` : `${root}/factory-output/${role === 'build' ? 'implementation' : 'plan'}.md`;
const args = ['exec', '--model', 'gpt-6-luna', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--sandbox', role === 'build' ? 'workspace-write' : 'read-only', '-c', 'approval_policy="never"', '--output-last-message', destination];
if (role === 'build') args.push('-c', 'sandbox_workspace_write.network_access=true');
if (role === 'review') args.push('--output-schema', '.factory/review.schema.json');
args.push('-');
const logPath = `${root}/${role}.log`;
const log = openSync(logPath, 'w', 0o600);
const result = spawnSync('codex', args, { env, input: readFileSync(`${root}/factory-${role}-prompt.md`), stdio: ['pipe', log, log], timeout: (role === 'build' ? 44 : 14) * 60 * 1000 });
closeSync(log);
if (result.status !== 0) {
  let diagnostic = readFileSync(logPath, 'utf8').split('\n').slice(-45).join('\n');
  const auth = JSON.parse(readFileSync(`${env.CODEX_HOME}/auth.json`, 'utf8'));
  for (const value of Object.values(auth.tokens ?? {})) if (typeof value === 'string' && value.length > 12) diagnostic = diagnostic.replaceAll(value, '[REDACTED]');
  console.error(diagnostic.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]'));
  throw new Error(`Codex ${role} failed (exit ${result.status}, signal ${result.signal}, error ${result.error?.code ?? 'none'})`);
}
console.log(`Codex ${role} completed on GitHub runner`);
