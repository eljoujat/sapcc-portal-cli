'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Loads .env configuration for the Portal client.
 * Resolution order (first found wins):
 *   1. Explicit envPath passed as argument
 *   2. .env in current working directory
 *   3. .env in the caller's project root (walk up until package.json or .git)
 */
function loadConfig(envPath) {
  const dotenv = require('dotenv');

  if (envPath) {
    const resolved = path.resolve(envPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`[sapcc-portal-cli] .env file not found at: ${resolved}`);
    }
    dotenv.config({ path: resolved });
  } else {
    const cwdEnv = path.join(process.cwd(), '.env');
    if (fs.existsSync(cwdEnv)) {
      dotenv.config({ path: cwdEnv });
    } else {
      const rootEnv = findEnvFile(process.cwd());
      if (rootEnv) {
        dotenv.config({ path: rootEnv });
      }
    }
  }

  const config = buildConfig();
  validate(config);
  return config;
}

function buildConfig() {
  return {
    apiUrl: (process.env.PORTAL_API_URL || 'https://portalapi.commerce.ondemand.com/v2').replace(/\/$/, ''),
    subscriptionCode: process.env.PORTAL_SUBSCRIPTION_CODE || '',
    tokenEndpoint: process.env.PORTAL_TOKEN_ENDPOINT || '',
    clientId: process.env.PORTAL_CLIENT_ID || '',
    clientSecret: process.env.PORTAL_CLIENT_SECRET || '',
    resource: process.env.PORTAL_RESOURCE || '',
    timeout: parseInt(process.env.PORTAL_TIMEOUT || '30000', 10),
    debug: process.env.PORTAL_DEBUG === 'true',
  };
}

function validate(config) {
  const missing = [];
  if (!config.subscriptionCode) missing.push('PORTAL_SUBSCRIPTION_CODE');
  if (!config.tokenEndpoint) missing.push('PORTAL_TOKEN_ENDPOINT');
  if (!config.clientId) missing.push('PORTAL_CLIENT_ID');
  if (!config.clientSecret) missing.push('PORTAL_CLIENT_SECRET');
  if (!config.resource) missing.push('PORTAL_RESOURCE');

  if (missing.length > 0) {
    throw new Error(
      `[sapcc-portal-cli] Missing required environment variables: ${missing.join(', ')}\n` +
      `Copy .env.example to .env and fill in the values.`
    );
  }
}

/**
 * Walk up directories looking for a .env file, stopping at filesystem root,
 * .git dir or package.json boundary.
 */
function findEnvFile(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) break;

    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, 'package.json'))
    ) {
      break;
    }
    dir = parent;
  }
  return null;
}

module.exports = { loadConfig, buildConfig, validate };
