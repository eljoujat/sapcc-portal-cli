'use strict';

const chalk = require('chalk');
const Table = require('cli-table3');

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Print a list of objects as a table, auto-detecting columns from the first row.
 */
function printTable(items, { columns, json = false, emptyMessage = '(no results)' } = {}) {
  if (json) return printJson(items);

  const rows = Array.isArray(items) ? items : (items?.value || items?.results || items?.items || []);

  if (!rows || rows.length === 0) {
    console.log(chalk.yellow(emptyMessage));
    return;
  }

  const cols = columns || Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');

  const table = new Table({
    head: cols.map((c) => chalk.cyan(c)),
    style: { head: [], border: [] },
    wordWrap: true,
  });

  rows.forEach((row) => {
    table.push(cols.map((c) => formatCell(row[c])));
  });

  console.log(table.toString());
  console.log(chalk.dim(`\n${rows.length} row(s)`));
}

function formatCell(val) {
  if (val === null || val === undefined) return chalk.dim('—');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function printObject(obj, { json = false } = {}) {
  if (json) return printJson(obj);

  const table = new Table({ style: { head: [], border: [] } });
  Object.entries(obj || {}).forEach(([k, v]) => {
    table.push({ [chalk.cyan(k)]: formatCell(v) });
  });
  console.log(table.toString());
}

function printSuccess(msg) {
  console.log(chalk.green(`\n✔  ${msg}\n`));
}

function printError(err, { verbose = false } = {}) {
  console.error(`\n${chalk.red('✘  Error:')} ${err.message}`);
  if (verbose && err.stack) {
    console.error(chalk.dim(err.stack));
  }
  console.error('');
}

async function withSpinner(text, fn) {
  const ora = require('ora');
  const spinner = ora({ text, color: 'cyan' }).start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (err) {
    spinner.fail(text);
    throw err;
  }
}

module.exports = {
  printJson,
  printTable,
  printObject,
  printSuccess,
  printError,
  withSpinner,
};
