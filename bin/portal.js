#!/usr/bin/env node
'use strict';

const { Command, Option } = require('commander');
const chalk = require('chalk');

const { createClient } = require('../src/index');
const { printTable, printObject, printSuccess, printError, withSpinner } = require('../src/formatters');

const pkg = require('../package.json');

const program = new Command();

program
  .name('sccp')
  .description(
    chalk.bold('SAP Commerce Cloud – Cloud Portal API CLI\n') +
    chalk.dim('Manage environments, builds, deployments, backups, scaling, certificates and more.')
  )
  .version(pkg.version, '-v, --version')
  .addOption(new Option('--env-file <path>', 'Path to .env file').env('PORTAL_ENV_FILE'))
  .addOption(new Option('--api-url <url>', 'Cloud Portal API base URL').env('PORTAL_API_URL'))
  .addOption(new Option('--subscription <code>', 'Subscription code').env('PORTAL_SUBSCRIPTION_CODE'))
  .addOption(new Option('--json', 'Output raw JSON'))
  .addOption(new Option('--debug', 'Dump internal HTTP exchange').env('PORTAL_DEBUG'))
  .addOption(new Option('--verbose', 'Verbose error stack trace'));

function buildClient(opts) {
  if (opts.debug) process.env.PORTAL_DEBUG = 'true';
  return createClient({
    envPath: opts.envFile,
    apiUrl: opts.apiUrl,
    subscriptionCode: opts.subscription,
    debug: !!opts.debug,
  });
}

function action(fn) {
  return async (...args) => {
    const cmd = args[args.length - 1];
    const globalOpts = program.opts();
    try {
      const client = buildClient(globalOpts);
      await fn({ client, globalOpts, args: args.slice(0, -1), cmd });
    } catch (err) {
      printError(err, { verbose: !!globalOpts.verbose });
      process.exit(1);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// environments
// ─────────────────────────────────────────────────────────────────────────────

const environments = program.command('environments').alias('env').description('Manage environments');

environments
  .command('list')
  .description('List environments')
  .option('--status <status>', 'Filter by status')
  .option('--deployment-status <status>', 'Filter by deployment status')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Fetching environments…', () =>
      client.listEnvironments({ status: opts.status, deploymentStatus: opts.deploymentStatus })
    );
    printTable(data, { json: globalOpts.json });
  }));

// ─────────────────────────────────────────────────────────────────────────────
// builds
// ─────────────────────────────────────────────────────────────────────────────

const builds = program.command('builds').description('Manage builds');

builds
  .command('list')
  .description('List builds')
  .option('--top <n>', 'Max results')
  .option('--skip <n>', 'Offset')
  .option('--order-by <field>', 'Order by (e.g. buildStartTimestamp desc)')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Fetching builds…', () =>
      client.listBuilds({ top: opts.top, skip: opts.skip, orderBy: opts.orderBy })
    );
    printTable(data, { json: globalOpts.json });
  }));

builds
  .command('get <buildCode>')
  .description('Get build details')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching build…', () => client.getBuild(args[0]));
    printObject(data, { json: globalOpts.json });
  }));

builds
  .command('progress <buildCode>')
  .description('Get build progress')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching build progress…', () => client.getBuildProgress(args[0]));
    printObject(data, { json: globalOpts.json });
  }));

builds
  .command('create')
  .description('Create a build from a branch')
  .requiredOption('--branch <branch>', 'Git branch to build')
  .requiredOption('--name <name>', 'Build name')
  .option('--application-code <code>', 'Application code')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner(`Creating build "${opts.name}"…`, () =>
      client.createBuild({ branch: opts.branch, name: opts.name, applicationCode: opts.applicationCode })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Build created');
  }));

builds
  .command('delete <buildCode>')
  .description('Delete a build')
  .action(action(async ({ client, globalOpts, args }) => {
    await withSpinner('Deleting build…', () => client.deleteBuild(args[0]));
    if (!globalOpts.json) printSuccess('Build deleted');
  }));

// ─────────────────────────────────────────────────────────────────────────────
// deployments
// ─────────────────────────────────────────────────────────────────────────────

const deployments = program.command('deployments').alias('deploy').description('Manage deployments');

deployments
  .command('list')
  .description('List deployments')
  .option('--build-code <code>', 'Filter by build')
  .option('--environment-code <code>', 'Filter by environment')
  .option('--status <status>', 'Filter by status')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Fetching deployments…', () =>
      client.listDeployments({
        buildCode: opts.buildCode,
        environmentCode: opts.environmentCode,
        status: opts.status,
      })
    );
    printTable(data, { json: globalOpts.json });
  }));

deployments
  .command('get <deploymentCode>')
  .description('Get deployment details')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching deployment…', () => client.getDeployment(args[0]));
    printObject(data, { json: globalOpts.json });
  }));

deployments
  .command('progress <deploymentCode>')
  .description('Get deployment progress')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching deployment progress…', () => client.getDeploymentProgress(args[0]));
    printObject(data, { json: globalOpts.json });
  }));

deployments
  .command('create')
  .description('Launch a deployment')
  .requiredOption('--build-code <code>', 'Build to deploy')
  .requiredOption('--environment-code <code>', 'Target environment')
  .requiredOption('--db-mode <mode>', 'Database update mode: NONE | UPDATE | INITIALIZE')
  .requiredOption('--strategy <strategy>', 'Strategy: ROLLING_UPDATE | RECREATE | GREEN')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Launching deployment…', () =>
      client.createDeployment({
        buildCode: opts.buildCode,
        environmentCode: opts.environmentCode,
        databaseUpdateMode: opts.dbMode,
        strategy: opts.strategy,
      })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Deployment launched');
  }));

deployments
  .command('decision <deploymentCode>')
  .description('Accept/Reject a GREEN (canary) deployment')
  .requiredOption('--decision <decision>', 'ACCEPT | REJECT | PREPARE_CANARY')
  .option('--reason <reason>', 'Reason for the decision')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner(`Applying decision ${opts.decision}…`, () =>
      client.createDeploymentDecision(args[0], { decision: opts.decision, reason: opts.reason })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Decision applied');
  }));

deployments
  .command('modes')
  .description('List allowed deployment modes per environment')
  .action(action(async ({ client, globalOpts }) => {
    const data = await withSpinner('Fetching deployment modes…', () => client.getDeploymentModes());
    printTable(data, { json: globalOpts.json });
  }));

// ─────────────────────────────────────────────────────────────────────────────
// endpoints
// ─────────────────────────────────────────────────────────────────────────────

const endpoints = program.command('endpoints').description('Manage environment endpoints');

endpoints
  .command('list <environmentCode>')
  .description('List endpoints of an environment')
  .option('--service <service>', 'Filter by service')
  .option('--web-proxy <proxy>', 'Filter by web proxy: public | private | nat')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Fetching endpoints…', () =>
      client.listEndpoints(args[0], { service: opts.service, webProxy: opts.webProxy })
    );
    printTable(data, { json: globalOpts.json });
  }));

endpoints
  .command('get <environmentCode> <endpointCode>')
  .description('Get endpoint details')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching endpoint…', () => client.getEndpoint(args[0], args[1]));
    printObject(data, { json: globalOpts.json });
  }));

endpoints
  .command('create <environmentCode>')
  .description('Create an endpoint')
  .requiredOption('--name <name>', 'Endpoint name')
  .requiredOption('--domain <domain>', 'Domain name')
  .requiredOption('--protocol <protocol>', 'HTTP | HTTPS')
  .requiredOption('--access <access>', 'ALLOW_ALL | DENY_ALL')
  .requiredOption('--k8s-service <service>', 'Kubernetes service behind the endpoint')
  .option('--k8s-version <version>', 'GREEN | BLUE | UNSPECIFIED', 'UNSPECIFIED')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Creating endpoint…', () =>
      client.createEndpoint(args[0], {
        name: opts.name,
        domainName: opts.domain,
        protocol: opts.protocol,
        access: opts.access,
        k8sService: opts.k8sService,
        k8sServiceVersion: opts.k8sVersion,
      })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Endpoint created');
  }));

endpoints
  .command('delete <environmentCode> <endpointCode>')
  .description('Delete an endpoint')
  .action(action(async ({ client, globalOpts, args }) => {
    await withSpinner('Deleting endpoint…', () => client.deleteEndpoint(args[0], args[1]));
    if (!globalOpts.json) printSuccess('Endpoint deleted');
  }));

// ─────────────────────────────────────────────────────────────────────────────
// databackups / datarestore
// ─────────────────────────────────────────────────────────────────────────────

const backups = program.command('backups').description('Manage data backups & restores');

backups
  .command('list <environmentCode>')
  .description('List data backups')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching backups…', () => client.listDatabackups(args[0]));
    printTable(data, { json: globalOpts.json });
  }));

backups
  .command('get <environmentCode> <databackupCode>')
  .description('Get backup details')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching backup…', () => client.getDatabackup(args[0], args[1]));
    printObject(data, { json: globalOpts.json });
  }));

backups
  .command('create <environmentCode>')
  .description('Create a data backup')
  .option('--description <desc>', 'Backup description')
  .option('--type <type>', 'QUICK | STANDARD', 'STANDARD')
  .option('--no-database', 'Exclude database')
  .option('--no-storage', 'Exclude storage')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Creating backup…', () =>
      client.createDatabackup(args[0], {
        description: opts.description,
        databackupType: opts.type,
        includeDatabase: opts.database,
        includeStorage: opts.storage,
      })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Backup created');
  }));

backups
  .command('delete <environmentCode> <databackupCode>')
  .description('Delete a data backup')
  .action(action(async ({ client, globalOpts, args }) => {
    await withSpinner('Deleting backup…', () => client.deleteDatabackup(args[0], args[1]));
    if (!globalOpts.json) printSuccess('Backup deleted');
  }));

backups
  .command('restore <environmentCode> <databackupCode>')
  .description('Restore data from a backup')
  .option('--source-environment <code>', 'Environment where the backup was created')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Launching restore…', () =>
      client.createDatarestore(args[0], { databackupCode: args[1], sourceEnvironmentCode: opts.sourceEnvironment })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Restore launched');
  }));

// ─────────────────────────────────────────────────────────────────────────────
// scaling
// ─────────────────────────────────────────────────────────────────────────────

const scaling = program.command('scaling').description('Manage environment scaling');

scaling
  .command('get <environmentCode>')
  .description('Get current scaling configuration')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching scaling…', () => client.getScaling(args[0]));
    printObject(data, { json: globalOpts.json });
  }));

scaling
  .command('options <environmentCode>')
  .description('List available scaling options')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching scaling options…', () => client.getScalingOptions(args[0]));
    printObject(data, { json: globalOpts.json });
  }));

scaling
  .command('update <environmentCode>')
  .description('Update scaling of a service')
  .requiredOption('--service <code>', 'Service code')
  .option('--replicas <n>', 'Number of replicas')
  .option('--cpu <cpu>', 'Requested CPU (e.g. 1.5)')
  .option('--memory <memory>', 'Requested memory (e.g. 2.5)')
  .option('--memory-scale-factor <factor>', 'Memory scale factor (1.0-2.99)')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Updating scaling…', () =>
      client.updateScaling(args[0], {
        serviceCode: opts.service,
        replicas: opts.replicas ? parseInt(opts.replicas, 10) : undefined,
        requestsCpu: opts.cpu,
        requestsMemory: opts.memory,
        memoryScaleFactor: opts.memoryScaleFactor ? parseFloat(opts.memoryScaleFactor) : undefined,
      })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Scaling updated');
  }));

// ─────────────────────────────────────────────────────────────────────────────
// certificates
// ─────────────────────────────────────────────────────────────────────────────

const certificates = program.command('certificates').alias('certs').description('Manage SSL certificates');

certificates
  .command('list')
  .description('List certificates')
  .action(action(async ({ client, globalOpts }) => {
    const data = await withSpinner('Fetching certificates…', () => client.listCertificates());
    printTable(data, { json: globalOpts.json });
  }));

certificates
  .command('get <certificateCode>')
  .description('Get certificate details')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching certificate…', () => client.getCertificate(args[0]));
    printObject(data, { json: globalOpts.json });
  }));

certificates
  .command('create')
  .description('Create a certificate (PEM)')
  .requiredOption('--name <name>', 'Certificate name')
  .requiredOption('--cert-file <path>', 'Path to certificate PEM file')
  .requiredOption('--key-file <path>', 'Path to private key PEM file')
  .option('--ca-file <path>', 'Path to CA certificate PEM file')
  .option('--description <desc>', 'Description')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const fs = require('fs');
    const opts = cmd.opts();
    const certificate = fs.readFileSync(opts.certFile, 'utf8');
    const certificateKey = fs.readFileSync(opts.keyFile, 'utf8');
    const caCertificate = opts.caFile ? fs.readFileSync(opts.caFile, 'utf8') : undefined;
    const data = await withSpinner('Creating certificate…', () =>
      client.createCertificate({ name: opts.name, certificate, certificateKey, caCertificate, description: opts.description })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Certificate created');
  }));

certificates
  .command('delete <certificateCode>')
  .description('Delete a certificate')
  .action(action(async ({ client, globalOpts, args }) => {
    await withSpinner('Deleting certificate…', () => client.deleteCertificate(args[0]));
    if (!globalOpts.json) printSuccess('Certificate deleted');
  }));

// ─────────────────────────────────────────────────────────────────────────────
// scheduled activities
// ─────────────────────────────────────────────────────────────────────────────

const activities = program.command('activities').description('Manage scheduled activities');

activities
  .command('list <environmentCode>')
  .description('List scheduled activities')
  .option('--type <type>', 'Filter by activity type')
  .option('--status <status>', 'Filter by status')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Fetching activities…', () =>
      client.listScheduledActivities(args[0], { activityType: opts.type, status: opts.status })
    );
    printTable(data, { json: globalOpts.json });
  }));

activities
  .command('get <environmentCode> <activityCode>')
  .description('Get activity details')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching activity…', () => client.getScheduledActivity(args[0], args[1]));
    printObject(data, { json: globalOpts.json });
  }));

activities
  .command('create <environmentCode>')
  .description('Schedule a new activity')
  .requiredOption('--type <type>', 'Activity type (e.g. MAINTENANCE_WINDOW)')
  .requiredOption('--at <timestamp>', 'Scheduled timestamp, ISO-8601 (e.g. 2025-02-01T22:00:00Z)')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Scheduling activity…', () =>
      client.createScheduledActivity(args[0], { activityType: opts.type, scheduledTimestamp: opts.at })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Activity scheduled');
  }));

activities
  .command('cancel <environmentCode> <activityCode>')
  .description('Cancel a scheduled activity')
  .action(action(async ({ client, globalOpts, args }) => {
    await withSpinner('Cancelling activity…', () => client.cancelScheduledActivity(args[0], args[1]));
    if (!globalOpts.json) printSuccess('Activity cancelled');
  }));

// ─────────────────────────────────────────────────────────────────────────────
// properties
// ─────────────────────────────────────────────────────────────────────────────

const properties = program.command('properties').alias('props').description('Manage service properties');

properties
  .command('get <environmentCode> <serviceCode> <propertyCode>')
  .description('Get a service property')
  .action(action(async ({ client, globalOpts, args }) => {
    const data = await withSpinner('Fetching property…', () => client.getProperty(args[0], args[1], args[2]));
    printObject(data, { json: globalOpts.json });
  }));

properties
  .command('set <environmentCode> <serviceCode> <propertyCode>')
  .description('Create or update a service property')
  .requiredOption('--key <key>', 'Property key')
  .requiredOption('--value <value>', 'Property value')
  .action(action(async ({ client, globalOpts, args, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner('Updating property…', () =>
      client.putProperty(args[0], args[1], args[2], { key: opts.key, value: opts.value })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Property updated');
  }));

// ─────────────────────────────────────────────────────────────────────────────
// roles
// ─────────────────────────────────────────────────────────────────────────────

const roles = program.command('roles').description('Manage roles & user role assignments');

roles
  .command('list')
  .description('List available roles')
  .action(action(async ({ client, globalOpts }) => {
    const data = await withSpinner('Fetching roles…', () => client.listRoles());
    printTable(data, { json: globalOpts.json });
  }));

roles
  .command('list-users')
  .description('List user role assignments')
  .action(action(async ({ client, globalOpts }) => {
    const data = await withSpinner('Fetching user roles…', () => client.listUserRoles());
    printTable(data, { json: globalOpts.json });
  }));

roles
  .command('assign')
  .description('Assign a role to a user on a list of environments')
  .requiredOption('--username <username>', 'Username')
  .requiredOption('--email <email>', 'Email')
  .requiredOption('--role <role>', 'Role to assign')
  .requiredOption('--environments <list>', 'Comma-separated environment codes')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const opts = cmd.opts();
    const data = await withSpinner(`Assigning role ${opts.role} to ${opts.username}…`, () =>
      client.assignUserRole({
        username: opts.username,
        email: opts.email,
        role: opts.role,
        environments: opts.environments.split(',').map((e) => e.trim()),
      })
    );
    printObject(data, { json: globalOpts.json });
    if (!globalOpts.json) printSuccess('Role assigned');
  }));

roles
  .command('unassign')
  .description('Remove a role assignment for a user')
  .requiredOption('--username <username>', 'Username')
  .requiredOption('--role <role>', 'Role to remove')
  .action(action(async ({ client, globalOpts, cmd }) => {
    const opts = cmd.opts();
    await withSpinner(`Removing role ${opts.role} from ${opts.username}…`, () =>
      client.deleteUserRole({ username: opts.username, role: opts.role })
    );
    if (!globalOpts.json) printSuccess('Role removed');
  }));

// ─────────────────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  printError(err);
  process.exit(1);
});
