'use strict';

/**
 * sapcc-portal-cli – Public programmatic API
 *
 * Usage as a Node.js dependency:
 *
 *   const { createClient } = require('sapcc-portal-cli');
 *
 *   const client = createClient();          // reads from process.env / .env
 *   // or
 *   const client = createClient({ envPath: '/path/to/.env' });
 *   // or (no .env, pass config directly)
 *   const client = createClient({
 *     apiUrl:           'https://portalapi.commerce.ondemand.com/v2',
 *     subscriptionCode: 'MY_SUB',
 *     tokenEndpoint:    'https://ycloud.accounts.ondemand.com/oauth2/token',
 *     clientId:         '...',
 *     clientSecret:     '...',
 *     resource:         '...',
 *   });
 *
 *   const envs = await client.listEnvironments();
 */

const PortalClient = require('./PortalClient');
const { loadConfig } = require('./config');

/**
 * Create a configured PortalClient instance.
 *
 * @param {object} [opts]
 * @param {string} [opts.envPath]           - Explicit path to .env file
 * @param {string} [opts.apiUrl]
 * @param {string} [opts.subscriptionCode]
 * @param {string} [opts.tokenEndpoint]
 * @param {string} [opts.clientId]
 * @param {string} [opts.clientSecret]
 * @param {string} [opts.resource]
 * @param {number} [opts.timeout]
 * @param {boolean} [opts.debug]
 * @returns {PortalClient}
 */
function createClient(opts = {}) {
  const hasDirectConfig =
    opts.subscriptionCode && opts.tokenEndpoint && opts.clientId && opts.clientSecret && opts.resource;

  let config;
  if (hasDirectConfig) {
    config = {
      apiUrl: (opts.apiUrl || 'https://portalapi.commerce.ondemand.com/v2').replace(/\/$/, ''),
      subscriptionCode: opts.subscriptionCode,
      tokenEndpoint: opts.tokenEndpoint,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
      resource: opts.resource,
      timeout: opts.timeout ?? 30000,
      debug: opts.debug ?? false,
    };
  } else {
    config = loadConfig(opts.envPath);
    if (opts.apiUrl) config.apiUrl = opts.apiUrl.replace(/\/$/, '');
    if (opts.subscriptionCode) config.subscriptionCode = opts.subscriptionCode;
    if (opts.tokenEndpoint) config.tokenEndpoint = opts.tokenEndpoint;
    if (opts.clientId) config.clientId = opts.clientId;
    if (opts.clientSecret) config.clientSecret = opts.clientSecret;
    if (opts.resource) config.resource = opts.resource;
    if (opts.timeout) config.timeout = opts.timeout;
    if (opts.debug !== undefined) config.debug = opts.debug;
  }

  return new PortalClient(config);
}

module.exports = {
  createClient,
  PortalClient,
};
