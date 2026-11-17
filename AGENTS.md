# Client portal

Read PLAN.md and .factory/approval.json. Implement only the dispatched milestone. The approved epic does not authorize scope changes, live charges or production deployment.

- All application implementation and verification run on GitHub-hosted runners. Do not assume developer-machine files or services exist.
- Treat organization identifiers as untrusted. Authorization and tenant constraints belong on the server.
- Use established authentication and official provider SDKs. Never invent payment or password protocols.
- Never commit credentials, environment files, runtime data or dependency/build directories.
- Do not modify .github/, .factory/, PLAN.md or AGENTS.md. These are trusted orchestration policy.
- Do not commit, push, open PRs, merge, or use GitHub/YouTrack credentials. Trusted jobs handle publication.
- Run lint, typecheck, tests, migrations and production build. Report failures truthfully.
- Preserve evidence in normal project tests and documentation. Do not weaken checks to pass.
