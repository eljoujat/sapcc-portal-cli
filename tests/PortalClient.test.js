'use strict';

const nock = require('nock');
const PortalClient = require('../src/PortalClient');

const config = {
  apiUrl: 'https://portalapi.commerce.ondemand.com/v2',
  subscriptionCode: 'SUB1',
  tokenEndpoint: 'https://ycloud.accounts.ondemand.com/oauth2/token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  resource: 'urn:resource',
};

function mockToken(expiresIn = 3600) {
  return nock('https://ycloud.accounts.ondemand.com')
    .post('/oauth2/token')
    .reply(200, { access_token: 'TOKEN123', expires_in: expiresIn, token_type: 'bearer' });
}

afterEach(() => {
  nock.cleanAll();
});

describe('PortalClient – authentication', () => {
  test('acquires a token and caches it across calls', async () => {
    const tokenScope = mockToken();
    const envScope = nock('https://portalapi.commerce.ondemand.com')
      .get('/v2/subscriptions/SUB1/environments')
      .times(2)
      .reply(200, { value: [] });

    const client = new PortalClient(config);
    await client.listEnvironments();
    await client.listEnvironments();

    expect(tokenScope.isDone()).toBe(true); // token requested only once
    expect(envScope.isDone()).toBe(true);
  });

  test('sends the bearer token in x-approuter-authorization header', async () => {
    mockToken();
    const scope = nock('https://portalapi.commerce.ondemand.com')
      .get('/v2/subscriptions/SUB1/environments')
      .matchHeader('x-approuter-authorization', 'Bearer TOKEN123')
      .reply(200, { value: [] });

    const client = new PortalClient(config);
    await client.listEnvironments();

    expect(scope.isDone()).toBe(true);
  });

  test('retries once on 401 by refreshing the token', async () => {
    mockToken();
    nock('https://portalapi.commerce.ondemand.com')
      .get('/v2/subscriptions/SUB1/builds')
      .reply(401, { message: 'expired' });

    mockToken();
    const retryScope = nock('https://portalapi.commerce.ondemand.com')
      .get('/v2/subscriptions/SUB1/builds')
      .reply(200, { value: [{ code: 'B1' }] });

    const client = new PortalClient(config);
    const data = await client.listBuilds();

    expect(data.value).toHaveLength(1);
    expect(retryScope.isDone()).toBe(true);
  });

  test('throws a descriptive error on non-2xx response', async () => {
    mockToken();
    nock('https://portalapi.commerce.ondemand.com')
      .get('/v2/subscriptions/SUB1/builds/UNKNOWN')
      .reply(404, { message: 'not found' });

    const client = new PortalClient(config);
    await expect(client.getBuild('UNKNOWN')).rejects.toThrow(/HTTP 404/);
  });
});

describe('PortalClient – endpoints', () => {
  test('createBuild posts branch/name payload', async () => {
    mockToken();
    const scope = nock('https://portalapi.commerce.ondemand.com')
      .post('/v2/subscriptions/SUB1/builds', { branch: 'develop', name: 'release-1.0', applicationCode: undefined })
      .reply(201, { code: 'BUILD1', buildStatus: 'SCHEDULED' });

    const client = new PortalClient(config);
    const data = await client.createBuild({ branch: 'develop', name: 'release-1.0' });

    expect(data.code).toBe('BUILD1');
    expect(scope.isDone()).toBe(true);
  });

  test('createDeployment posts the correct payload', async () => {
    mockToken();
    const scope = nock('https://portalapi.commerce.ondemand.com')
      .post('/v2/subscriptions/SUB1/deployments', {
        buildCode: 'BUILD1',
        environmentCode: 'staging',
        databaseUpdateMode: 'UPDATE',
        strategy: 'ROLLING_UPDATE',
      })
      .reply(201, { code: 'DEPLOY1', deploymentStatus: 'SCHEDULED' });

    const client = new PortalClient(config);
    const data = await client.createDeployment({
      buildCode: 'BUILD1',
      environmentCode: 'staging',
      databaseUpdateMode: 'UPDATE',
      strategy: 'ROLLING_UPDATE',
    });

    expect(data.code).toBe('DEPLOY1');
    expect(scope.isDone()).toBe(true);
  });

  test('listEndpoints scopes the URL to environment', async () => {
    mockToken();
    const scope = nock('https://portalapi.commerce.ondemand.com')
      .get('/v2/subscriptions/SUB1/environments/staging/endpoints')
      .query({ webProxy: 'public' })
      .reply(200, { value: [] });

    const client = new PortalClient(config);
    await client.listEndpoints('staging', { webProxy: 'public' });

    expect(scope.isDone()).toBe(true);
  });
});
