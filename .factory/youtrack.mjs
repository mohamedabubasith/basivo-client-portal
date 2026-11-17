import { readFileSync } from 'node:fs';
const token = process.env.YOUTRACK_TOKEN;
if (!token) {
  console.log('YOUTRACK_TOKEN is not configured: ticket synchronization is unavailable; approved snapshot applies only to AIP-6. No ticket is marked done.');
  process.exit(0);
}
const approval = JSON.parse(readFileSync('.factory/approval.json', 'utf8'));
const endpoint = 'https://basivo.youtrack.cloud/api';
const request = async (path, options = {}) => {
  const response = await fetch(endpoint + path, { ...options, redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`YouTrack HTTP ${response.status}`);
  return response.json();
};
const comments = await request(`/issues/${approval.epic}/comments?fields=author(login),text,created&$top=100&$skip=0`);
if (!comments.some(c => c.author?.login === approval.approvedBy && c.created === approval.approvalCreatedAt && c.text.replaceAll('**', '').trim() === approval.approvalText)) throw new Error('Human approval is missing or changed');
if (comments.some(c => c.created > approval.approvalCreatedAt && c.author?.login === approval.approvedBy && /\b(revoke|withdraw|stop building|reject plan)\b/i.test(c.text))) throw new Error('Approval has been revoked');
if (process.argv[2] === 'check') {
  console.log('Live YouTrack approval is still valid');
  process.exit(0);
}
const run = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const text = process.argv[2] === 'plan'
  ? `GitHub runner implementation plan for ${approval.ticket}, within approved epic v1 (${approval.planSha256}).\n\n${readFileSync(process.env.RUNNER_TEMP + '/factory-output/plan.md', 'utf8')}\n\nEvidence: ${run}`
  : `GitHub runner independently tested and reviewed the exact candidate and confirmed merge: ${process.env.PR_URL}\n\nEvidence: ${run}\n\nThis comment does not mark the epic or later milestones complete.`;
await request(`/issues/${approval.ticket}/comments?fields=id`, { method: 'POST', body: JSON.stringify({ text }) });
console.log('YouTrack evidence comment posted');
