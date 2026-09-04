# Changelog

## 1.0.0 — Initial release

- OAuth2 `client_credentials` authentication with in-memory token cache & transparent refresh on 401
- CLI (`sccp`) and Node.js library (`createClient`) dual mode
- Commands: `environments`, `builds`, `deployments`, `endpoints`, `backups`, `scaling`, `certificates`, `activities`, `properties`, `roles`
- Table / JSON output via `--json`
- `.env` based configuration with auto-discovery (cwd → project root)
- Unit tests with `nock` HTTP mocking
