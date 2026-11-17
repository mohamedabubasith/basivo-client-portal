import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const root = process.env.RUNNER_TEMP;
if (!root) throw new Error('This command must run on a GitHub runner');
const approval = JSON.parse(readFileSync('.factory/approval.json', 'utf8'));
const digest = createHash('sha256').update(readFileSync('PLAN.md')).digest('hex');
if (digest !== approval.planSha256 || process.env.GITHUB_ACTOR !== approval.dispatchActor) throw new Error('Approved plan or authorized actor mismatch');
const command = process.argv[2];
const out = join(root, 'factory-output');
mkdirSync(out, { recursive: true });

if (command === 'preflight') {
  writeFileSync(join(out, 'approval.json'), JSON.stringify(approval, null, 2));
  console.log(`Approved scope: ${approval.ticket}: ${approval.scope}`);
} else if (command === 'prompt') {
  const role = process.argv[3];
  const scope = readFileSync('.factory/m1.md', 'utf8');
  const instructions = role === 'plan'
    ? 'Act as the planning agent. Read PLAN.md, AGENTS.md and the milestone below. Produce a concrete M1 implementation plan with acceptance commands, files, risks and dependency choices. Stay within the approved scope. Do not change any files. Your plan will be published as evidence; scope deviations require new human approval.'
    : role === 'build'
      ? `Act as the implementation agent on this GitHub Actions runner. Read PLAN.md and AGENTS.md. Implement the milestone completely and run its checks. Do not commit or push. Do not modify trusted policy files. Planning evidence:\n${readFileSync(join(out, 'plan.md'), 'utf8')}`
      : 'Act as an independent reviewer in a fresh checkout of the exact candidate commit. Read PLAN.md, AGENTS.md, .factory/m1.md and inspect the complete diff against FACTORY_BASE_SHA. Look for correctness, security, missing tests, bad migrations, placeholder behavior and mismatches with M1 acceptance. Do not modify files. Approve only if no blocking findings remain; otherwise request_changes. Return the required structured JSON. Do not trust the implementation summary as evidence.';
  writeFileSync(join(root, `factory-${role}-prompt.md`), `${instructions}\n\n${scope}\n`);
} else if (command === 'package') {
  if (git('rev-parse', 'HEAD').trim() !== process.env.FACTORY_BASE_SHA) throw new Error('Agent moved HEAD');
  git('add', '--intent-to-add', '--all');
  const paths = git('diff', 'HEAD', '--name-only', '-z').split('\0').filter(Boolean);
  if (!paths.length || paths.length > 250) throw new Error('Invalid candidate file count');
  for (const path of paths) {
    if (/^(?:\.github|\.factory|\.git)(?:\/|$)/.test(path) || ['PLAN.md', 'AGENTS.md'].includes(path)) throw new Error(`Protected policy changed: ${path}`);
    if (/(^|\/)(?:node_modules|\.next|coverage)(\/|$)/.test(path) || /(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example')) throw new Error(`Forbidden artifact: ${path}`);
    let stat;
    try { stat = lstatSync(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error(`Invalid candidate file: ${path}`);
    const content = readFileSync(path, 'utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./.test(content)) throw new Error(`Possible credential in candidate: ${path}`);
  }
  for (const path of ['package.json', 'package-lock.json', 'Dockerfile', 'compose.yml', '.env.example', '.gitignore']) {
    if (!lstatSync(path).isFile()) throw new Error(`Missing required file ${path}`);
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const name of ['lint', 'typecheck', 'test', 'db:migrate', 'test:integration', 'build', 'start']) {
    if (!pkg.scripts?.[name]) throw new Error(`Missing required npm script: ${name}`);
  }
  const patch = git('diff', 'HEAD', '--binary', '--no-ext-diff');
  if (Buffer.byteLength(patch) > 8 * 1024 * 1024) throw new Error('Candidate exceeds size budget');
  writeFileSync(join(out, 'change.patch'), patch);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ base: process.env.FACTORY_BASE_SHA, ticket: approval.ticket, paths, patchSha256: createHash('sha256').update(patch).digest('hex') }, null, 2));
  console.log(`Packaged ${paths.length} candidate files`);
} else if (command === 'validate') {
  const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  const patch = readFileSync(join(out, 'change.patch'));
  if (manifest.base !== git('rev-parse', 'HEAD').trim() || manifest.ticket !== approval.ticket || createHash('sha256').update(patch).digest('hex') !== manifest.patchSha256) throw new Error('Candidate provenance mismatch');
  git('apply', '--check', join(out, 'change.patch'));
  git('apply', join(out, 'change.patch'));
  // Re-run all path and content checks after applying the untrusted artifact.
  process.argv[2] = 'package';
  execFileSync(process.execPath, ['.factory/runner.mjs', 'package'], { stdio: 'inherit', env: { ...process.env, FACTORY_BASE_SHA: manifest.base } });
} else if (command === 'review-gate') {
  const result = JSON.parse(readFileSync(join(root, 'review.json'), 'utf8'));
  if (result.verdict !== 'approve' || !Array.isArray(result.findings) || result.findings.length) throw new Error(`Independent review rejected candidate: ${result.summary}`);
  console.log('Independent review approved candidate');
} else {
  throw new Error(`Unknown command: ${command}`);
}
