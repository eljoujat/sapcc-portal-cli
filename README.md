# sapcc-portal-cli

> SAP Commerce Cloud (CCv2) **Cloud Portal API** client — manage environments, builds, deployments, backups, scaling, certificates, scheduled activities, properties and roles from your terminal or Node.js code.

[![CI](https://github.com/eljoujat/sapcc-portal-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/eljoujat/sapcc-portal-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/sapcc-portal-cli.svg)](https://www.npmjs.com/package/sapcc-portal-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Companion CLI to [`sapcc-hac-client`](https://github.com/eljoujat/sapcc-hac-client) (which targets the HAC / Groovy / FlexibleSearch console). This package targets the **Cloud Portal REST API** — i.e. everything a DevOps engineer does in the CCv2 Cloud Portal UI: builds, deployments, environments, backups, scaling, endpoints, certificates…

---

## Features

| | |
|---|---|
| 🔐 | **OAuth2 client_credentials** — token acquired & cached automatically, refreshed transparently on expiry/401 |
| 🚀 | **Builds & Deployments** — create, list, track progress, ROLLING_UPDATE / RECREATE / GREEN (canary) |
| 🌱 | **Environments** — list & filter by status/deployment status |
| 💾 | **Backups & restores** — create/list/delete data backups, restore from backup |
| 📈 | **Scaling** — read/update replicas, CPU, memory per service |
| 🌐 | **Endpoints** — list/create/delete public/private endpoints |
| 🔏 | **Certificates** — manage SSL certificates (PEM) |
| ⏰ | **Scheduled activities** — plan/cancel maintenance windows and other activities |
| ⚙️ | **Service properties** — read/write configuration properties |
| 👥 | **Roles** — list roles, assign/remove user role assignments |
| 📦 | **Dual-mode** — use as a **CLI** (`npx`) or as a **Node.js library** |
| 🌍 | **Credentials from `.env`** — never hard-code secrets |

---

## Quick Start

```bash
# 1. Install globally
npm install -g sapcc-portal-cli

# 2. Create .env
cp .env.example .env   # fill in your OAuth2 client credentials

# 3. List environments
sccp environments list

# 4. Create a build & deploy it
sccp builds create --branch develop --name release-2.5.0
sccp builds progress <buildCode>
sccp deployments create --build-code <buildCode> --environment-code staging \
  --db-mode UPDATE --strategy ROLLING_UPDATE
sccp deployments progress <deploymentCode>
```

No global install? Use `npx`:

```bash
npx sapcc-portal-cli environments list
```

---

## Installation

```bash
# Global CLI
npm install -g sapcc-portal-cli

# Project dependency
npm install sapcc-portal-cli
```

---

## Configuration — `.env`

Create a `.env` file in your project root:

```dotenv
# Required
PORTAL_API_URL=https://portalapi.commerce.ondemand.com/v2
PORTAL_SUBSCRIPTION_CODE=your_subscription_code
PORTAL_TOKEN_ENDPOINT=https://ycloud.accounts.ondemand.com/oauth2/token
PORTAL_CLIENT_ID=your_client_id
PORTAL_CLIENT_SECRET=your_client_secret
PORTAL_RESOURCE=your_resource_urn

# Optional
PORTAL_TIMEOUT=30000
PORTAL_DEBUG=false
```

> 🔒 Add `.env` to `.gitignore` — never commit credentials.

---

## CLI Reference

### Global options

```
--env-file <path>       Path to .env file           [env: PORTAL_ENV_FILE]
--api-url <url>         Cloud Portal API base URL   [env: PORTAL_API_URL]
--subscription <code>   Subscription code            [env: PORTAL_SUBSCRIPTION_CODE]
--json                  Raw JSON output
--debug                 Verbose HTTP logging         [env: PORTAL_DEBUG]
--verbose               Verbose error stack trace
-v, --version           Show version
```

### Commands overview

```
sccp environments list [--status <s>] [--deployment-status <s>]

sccp builds list [--top <n>] [--skip <n>] [--order-by <field>]
sccp builds get <buildCode>
sccp builds progress <buildCode>
sccp builds create --branch <branch> --name <name> [--application-code <code>]
sccp builds delete <buildCode>

sccp deployments list [--build-code <c>] [--environment-code <c>] [--status <s>]
sccp deployments get <deploymentCode>
sccp deployments progress <deploymentCode>
sccp deployments create --build-code <c> --environment-code <c> --db-mode <NONE|UPDATE|INITIALIZE> --strategy <ROLLING_UPDATE|RECREATE|GREEN>
sccp deployments decision <deploymentCode> --decision <ACCEPT|REJECT|PREPARE_CANARY> [--reason <r>]
sccp deployments modes

sccp endpoints list <environmentCode> [--service <s>] [--web-proxy <public|private|nat>]
sccp endpoints get <environmentCode> <endpointCode>
sccp endpoints create <environmentCode> --name <n> --domain <d> --protocol <HTTP|HTTPS> --access <ALLOW_ALL|DENY_ALL> --k8s-service <s> [--k8s-version <GREEN|BLUE|UNSPECIFIED>]
sccp endpoints delete <environmentCode> <endpointCode>

sccp backups list <environmentCode>
sccp backups get <environmentCode> <databackupCode>
sccp backups create <environmentCode> [--description <d>] [--type <QUICK|STANDARD>] [--no-database] [--no-storage]
sccp backups delete <environmentCode> <databackupCode>
sccp backups restore <environmentCode> <databackupCode> [--source-environment <c>]

sccp scaling get <environmentCode>
sccp scaling options <environmentCode>
sccp scaling update <environmentCode> --service <s> [--replicas <n>] [--cpu <c>] [--memory <m>] [--memory-scale-factor <f>]

sccp certificates list
sccp certificates get <certificateCode>
sccp certificates create --name <n> --cert-file <path> --key-file <path> [--ca-file <path>] [--description <d>]
sccp certificates delete <certificateCode>

sccp activities list <environmentCode> [--type <t>] [--status <s>]
sccp activities get <environmentCode> <activityCode>
sccp activities create <environmentCode> --type <t> --at <ISO-8601 timestamp>
sccp activities cancel <environmentCode> <activityCode>

sccp properties get <environmentCode> <serviceCode> <propertyCode>
sccp properties set <environmentCode> <serviceCode> <propertyCode> --key <k> --value <v>

sccp roles list
sccp roles list-users
sccp roles assign --username <u> --email <e> --role <r> --environments <e1,e2,...>
sccp roles unassign --username <u> --role <r>
```

### Examples

```bash
# Deploy workflow
sccp builds create --branch develop --name release-2.5.0
sccp builds progress BUILD_CODE
sccp deployments create --build-code BUILD_CODE --environment-code staging --db-mode UPDATE --strategy ROLLING_UPDATE
sccp deployments progress DEPLOY_CODE

# Canary (GREEN) deployment
sccp deployments create --build-code BUILD_CODE --environment-code prod --db-mode UPDATE --strategy GREEN
sccp deployments decision DEPLOY_CODE --decision ACCEPT --reason "Validated on staging"

# Backup before a risky deployment
sccp backups create prod --description "Before release-2.5.0" --type STANDARD

# Scale a service
sccp scaling update prod --service storefront --replicas 4 --memory-scale-factor 1.5

# JSON output for scripting
sccp environments list --json | jq '.value[] | select(.code=="prod")'
```

---

## Node.js API

```js
const { createClient } = require('sapcc-portal-cli');

// Reads .env automatically from cwd / project root
const client = createClient();

// Direct credentials (no .env)
const client = createClient({
  apiUrl:           'https://portalapi.commerce.ondemand.com/v2',
  subscriptionCode: 'MY_SUB',
  tokenEndpoint:    'https://ycloud.accounts.ondemand.com/oauth2/token',
  clientId:         '...',
  clientSecret:     '...',
  resource:         '...',
});

const envs = await client.listEnvironments();

const build = await client.createBuild({ branch: 'develop', name: 'release-2.5.0' });
await client.getBuildProgress(build.code);

const deployment = await client.createDeployment({
  buildCode: build.code,
  environmentCode: 'staging',
  databaseUpdateMode: 'UPDATE',
  strategy: 'ROLLING_UPDATE',
});
```

All methods mirror the CLI commands 1:1 (see [`src/PortalClient.js`](src/PortalClient.js) for the full list): `listEnvironments`, `listBuilds`, `getBuild`, `getBuildProgress`, `createBuild`, `deleteBuild`, `listDeployments`, `getDeployment`, `getDeploymentProgress`, `createDeployment`, `createDeploymentDecision`, `getDeploymentModes`, `listEndpoints`, `getEndpoint`, `createEndpoint`, `deleteEndpoint`, `listDatabackups`, `getDatabackup`, `createDatabackup`, `deleteDatabackup`, `createDatarestore`, `getScaling`, `getScalingOptions`, `updateScaling`, `listCertificates`, `getCertificate`, `createCertificate`, `deleteCertificate`, `listScheduledActivities`, `getScheduledActivity`, `createScheduledActivity`, `cancelScheduledActivity`, `getProperty`, `putProperty`, `listRoles`, `listUserRoles`, `assignUserRole`, `deleteUserRole`.

---

## Authentication Flow (internals)

```
POST {tokenEndpoint}
  client_id, client_secret, grant_type=client_credentials, resource
  → access_token (cached until expiry, refreshed 30s before expiry)

Every API call:
  x-approuter-authorization: Bearer <access_token>

On HTTP 401:
  → token invalidated, refreshed, request retried once
```

---

## Project Structure

```
sapcc-portal-cli/
├── bin/
│   └── portal.js              ← CLI entry point (npx / global) — command "sccp"
├── src/
│   ├── index.js                ← Public API (createClient)
│   ├── PortalClient.js         ← Core: OAuth2 auth + all Cloud Portal API operations
│   ├── config.js                ← .env loader with auto-discovery
│   └── formatters.js            ← CLI output: tables, JSON, colours, spinner
├── tests/
│   └── PortalClient.test.js    ← Unit tests (Jest + nock)
├── .env.example
├── CHANGELOG.md
└── package.json
```

---

## Running Tests

```bash
npm install
npm test
npm run test:coverage
```

---

## Related

- [`sapcc-hac-client`](https://github.com/eljoujat/sapcc-hac-client) — companion CLI for the HAC (Groovy scripting & FlexibleSearch)

## License

[MIT](LICENSE) © Youssef El Jaoujat
