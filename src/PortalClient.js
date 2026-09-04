'use strict';

const axios = require('axios');

/**
 * PortalClient – SAP Commerce Cloud (CCv2) Cloud Portal API client.
 *
 * Auth: OAuth2 client_credentials flow.
 *   POST {tokenEndpoint}
 *     client_id, client_secret, grant_type=client_credentials, resource
 *   → access_token cached in-memory until expiry (refreshed transparently).
 *
 * All API calls are scoped to a single `subscriptionCode` and sent with:
 *   x-approuter-authorization: Bearer <access_token>
 */
class PortalClient {
  /**
   * @param {object} config
   * @param {string} config.apiUrl            - Base URL, e.g. https://portalapi.commerce.ondemand.com/v2
   * @param {string} config.subscriptionCode  - Subscription code
   * @param {string} config.tokenEndpoint     - OAuth2 token endpoint
   * @param {string} config.clientId
   * @param {string} config.clientSecret
   * @param {string} config.resource          - OAuth2 resource URN
   * @param {number} [config.timeout=30000]
   * @param {boolean} [config.debug=false]
   */
  constructor(config) {
    this.apiUrl = (config.apiUrl || '').replace(/\/$/, '');
    this.subscriptionCode = config.subscriptionCode;
    this.tokenEndpoint = config.tokenEndpoint;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.resource = config.resource;
    this.timeout = config.timeout || 30000;
    this._debug = !!config.debug || process.env.PORTAL_DEBUG === 'true';

    this._token = null;
    this._tokenExpiresAt = 0;

    this._http = axios.create({
      timeout: this.timeout,
      validateStatus: () => true,
    });
  }

  _log(msg) {
    if (this._debug) process.stderr.write(`[PORTAL DEBUG] ${msg}\n`);
  }

  // ─────────────────────────────────────────────
  //  Authentication (OAuth2 client_credentials)
  // ─────────────────────────────────────────────

  async _getToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt - 30_000) {
      return this._token;
    }

    this._log(`Requesting new access token from ${this.tokenEndpoint}`);

    const body = new URLSearchParams();
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);
    body.set('grant_type', 'client_credentials');
    body.set('resource', this.resource);

    const res = await this._http.post(this.tokenEndpoint, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    if (res.status < 200 || res.status >= 300 || !res.data?.access_token) {
      throw new Error(
        `[PortalClient] OAuth2 token request failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`
      );
    }

    this._token = res.data.access_token;
    const expiresIn = parseInt(res.data.expires_in || '3600', 10);
    this._tokenExpiresAt = now + expiresIn * 1000;
    this._log(`Token acquired, expires in ${expiresIn}s`);

    return this._token;
  }

  /** Force a token refresh on next call. */
  invalidateToken() {
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  // ─────────────────────────────────────────────
  //  Generic HTTP helpers
  // ─────────────────────────────────────────────

  async _request(method, urlPath, { params, data } = {}) {
    const token = await this._getToken();
    const url = `${this.apiUrl}${urlPath}`;

    this._log(`${method} ${url} params=${JSON.stringify(params || {})}`);

    const res = await this._http.request({
      method,
      url,
      params,
      data,
      headers: {
        'x-approuter-authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Transparent retry once on 401 (expired/rejected token)
    if (res.status === 401) {
      this._log('401 received, refreshing token and retrying once');
      this.invalidateToken();
      const retryToken = await this._getToken();
      const retryRes = await this._http.request({
        method,
        url,
        params,
        data,
        headers: {
          'x-approuter-authorization': `Bearer ${retryToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      return this._assertSuccess(retryRes, urlPath);
    }

    return this._assertSuccess(res, urlPath);
  }

  _assertSuccess(res, urlPath) {
    if (res.status < 200 || res.status >= 300) {
      const msg = typeof res.data === 'object' ? JSON.stringify(res.data) : res.data;
      throw new Error(`[PortalClient] HTTP ${res.status} on ${urlPath}: ${msg}`);
    }
    return res.data;
  }

  get _sub() {
    return `/subscriptions/${this.subscriptionCode}`;
  }

  // ─────────────────────────────────────────────
  //  Environments
  // ─────────────────────────────────────────────

  listEnvironments({ status, deploymentStatus } = {}) {
    return this._request('GET', `${this._sub}/environments`, {
      params: { status, deploymentStatus },
    });
  }

  // ─────────────────────────────────────────────
  //  Builds
  // ─────────────────────────────────────────────

  listBuilds({ top, skip, orderBy } = {}) {
    return this._request('GET', `${this._sub}/builds`, {
      params: { top, skip, orderBy },
    });
  }

  getBuild(buildCode) {
    return this._request('GET', `${this._sub}/builds/${buildCode}`);
  }

  getBuildProgress(buildCode) {
    return this._request('GET', `${this._sub}/builds/${buildCode}/progress`);
  }

  createBuild({ branch, name, applicationCode }) {
    return this._request('POST', `${this._sub}/builds`, {
      data: { branch, name, applicationCode },
    });
  }

  deleteBuild(buildCode) {
    return this._request('DELETE', `${this._sub}/builds/${buildCode}`);
  }

  // ─────────────────────────────────────────────
  //  Deployments
  // ─────────────────────────────────────────────

  listDeployments({ buildCode, environmentCode, status, top, skip } = {}) {
    return this._request('GET', `${this._sub}/deployments`, {
      params: { buildCode, environmentCode, status, top, skip },
    });
  }

  getDeployment(deploymentCode) {
    return this._request('GET', `${this._sub}/deployments/${deploymentCode}`);
  }

  getDeploymentProgress(deploymentCode) {
    return this._request('GET', `${this._sub}/deployments/${deploymentCode}/progress`);
  }

  createDeployment({ buildCode, environmentCode, databaseUpdateMode, strategy }) {
    return this._request('POST', `${this._sub}/deployments`, {
      data: { buildCode, environmentCode, databaseUpdateMode, strategy },
    });
  }

  createDeploymentDecision(deploymentCode, { decision, reason } = {}) {
    return this._request('POST', `${this._sub}/deployments/${deploymentCode}/decisions`, {
      data: { decision, reason },
    });
  }

  getDeploymentModes() {
    return this._request('GET', `${this._sub}/deploymentmodes`);
  }

  // ─────────────────────────────────────────────
  //  Endpoints
  // ─────────────────────────────────────────────

  listEndpoints(environmentCode, { service, webProxy } = {}) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/endpoints`, {
      params: { service, webProxy },
    });
  }

  getEndpoint(environmentCode, endpointCode) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/endpoints/${endpointCode}`);
  }

  createEndpoint(environmentCode, { name, domainName, protocol, access, k8sService, k8sServiceVersion }) {
    return this._request('POST', `${this._sub}/environments/${environmentCode}/endpoints`, {
      data: { name, domainName, protocol, access, k8sService, k8sServiceVersion },
    });
  }

  deleteEndpoint(environmentCode, endpointCode) {
    return this._request('DELETE', `${this._sub}/environments/${environmentCode}/endpoints/${endpointCode}`);
  }

  // ─────────────────────────────────────────────
  //  Data backups / restores
  // ─────────────────────────────────────────────

  listDatabackups(environmentCode) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/databackups`);
  }

  getDatabackup(environmentCode, databackupCode) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/databackups/${databackupCode}`);
  }

  createDatabackup(environmentCode, { description, includeDatabase = true, includeStorage = true, databackupType = 'STANDARD' } = {}) {
    return this._request('POST', `${this._sub}/environments/${environmentCode}/databackups`, {
      data: { description, includeDatabase, includeStorage, databackupType },
    });
  }

  deleteDatabackup(environmentCode, databackupCode) {
    return this._request('DELETE', `${this._sub}/environments/${environmentCode}/databackups/${databackupCode}`);
  }

  createDatarestore(environmentCode, { databackupCode, sourceEnvironmentCode } = {}) {
    return this._request('POST', `${this._sub}/environments/${environmentCode}/datarestores`, {
      data: { databackupCode, sourceEnvironmentCode },
    });
  }

  // ─────────────────────────────────────────────
  //  Scaling
  // ─────────────────────────────────────────────

  getScaling(environmentCode) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/scaling`);
  }

  getScalingOptions(environmentCode) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/scaling/options`);
  }

  updateScaling(environmentCode, { serviceCode, replicas, requestsCpu, requestsMemory, memoryScaleFactor }) {
    return this._request('PUT', `${this._sub}/environments/${environmentCode}/scaling/services/${serviceCode}`, {
      data: { replicas, requestsCpu, requestsMemory, memoryScaleFactor },
    });
  }

  // ─────────────────────────────────────────────
  //  Certificates
  // ─────────────────────────────────────────────

  listCertificates() {
    return this._request('GET', `${this._sub}/certificates`);
  }

  getCertificate(certificateCode) {
    return this._request('GET', `${this._sub}/certificates/${certificateCode}`);
  }

  createCertificate({ name, certificate, certificateKey, caCertificate, description }) {
    return this._request('POST', `${this._sub}/certificates`, {
      data: { name, certificate, certificateKey, caCertificate, description },
    });
  }

  deleteCertificate(certificateCode) {
    return this._request('DELETE', `${this._sub}/certificates/${certificateCode}`);
  }

  // ─────────────────────────────────────────────
  //  Scheduled activities
  // ─────────────────────────────────────────────

  listScheduledActivities(environmentCode, { activityType, status, top, skip } = {}) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/scheduledactivities`, {
      params: { activityType, status, top, skip },
    });
  }

  getScheduledActivity(environmentCode, activityCode) {
    return this._request('GET', `${this._sub}/environments/${environmentCode}/scheduledactivities/${activityCode}`);
  }

  createScheduledActivity(environmentCode, { activityType, scheduledTimestamp }) {
    return this._request('POST', `${this._sub}/environments/${environmentCode}/scheduledactivities`, {
      data: { activityType, scheduledTimestamp },
    });
  }

  cancelScheduledActivity(environmentCode, activityCode) {
    return this._request('DELETE', `${this._sub}/environments/${environmentCode}/scheduledactivities/${activityCode}`);
  }

  // ─────────────────────────────────────────────
  //  Service properties
  // ─────────────────────────────────────────────

  getProperty(environmentCode, serviceCode, propertyCode) {
    return this._request(
      'GET',
      `${this._sub}/environments/${environmentCode}/services/${serviceCode}/properties/${propertyCode}`
    );
  }

  putProperty(environmentCode, serviceCode, propertyCode, { key, value }) {
    return this._request(
      'PUT',
      `${this._sub}/environments/${environmentCode}/services/${serviceCode}/properties/${propertyCode}`,
      { data: { key, value } }
    );
  }

  // ─────────────────────────────────────────────
  //  Roles
  // ─────────────────────────────────────────────

  listRoles() {
    return this._request('GET', `${this._sub}/roles`);
  }

  listUserRoles() {
    return this._request('GET', `${this._sub}/userroles`);
  }

  assignUserRole({ username, email, role, environments }) {
    return this._request('POST', `${this._sub}/userroles`, {
      data: { username, email, role, environments },
    });
  }

  deleteUserRole({ username, role }) {
    return this._request('DELETE', `${this._sub}/userroles`, {
      data: { username, role },
    });
  }
}

module.exports = PortalClient;
