const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert/strict');

const runnerRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(runnerRoot, '../..');
const fixturePath = path.join(
  runnerRoot,
  'regression',
  'code-graph-queries.json',
);
const targetWorkspace = path.join(
  workspaceRoot,
  'init-states',
  'angular-nest-team-crud',
);
const runsRoot = path.join(workspaceRoot, 'runs', 'agent-code-graph');
const DEFAULT_TIMEOUT_MS = 30_000;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteCypherForTargetWorkspace(cypher) {
  const runWorkspacePattern = new RegExp(
    `${escapeRegExp(runsRoot)}\\/[^/]+\\/[^/]+\\/`,
    'g',
  );

  return cypher.replace(runWorkspacePattern, `${targetWorkspace}/`);
}

function normalizeString(value) {
  const runWorkspacePattern = new RegExp(
    `${escapeRegExp(runsRoot)}\\/[^/]+\\/[^/]+\\/`,
    'g',
  );

  return value
    .replace(runWorkspacePattern, '')
    .replace(new RegExp(`${escapeRegExp(targetWorkspace)}\\/`, 'g'), '');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === 'string') return normalizeString(value);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  if (text.startsWith('ERROR:') || text.startsWith('Error:')) {
    return 'ERROR';
  }

  const errorLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Error: '));

  return errorLines.length > 0 ? errorLines[errorLines.length - 1] : text;
}

function parseActual(result) {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();

  if (result.status === 0) {
    return { kind: 'json', value: JSON.parse(stdout || '[]') };
  }

  return {
    kind: 'text',
    value: normalizeText(stderr || stdout),
  };
}

function runCase(entry) {
  const result = spawnSync('code-graph', [
    'query',
    rewriteCypherForTargetWorkspace(entry.cypher),
  ], {
    cwd: targetWorkspace,
    encoding: 'utf8',
    timeout: Number(process.env.CODE_GRAPH_REGRESSION_TIMEOUT_MS) ||
      DEFAULT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.error) {
    return {
      pass: false,
      message: result.error.message,
    };
  }

  const actual = parseActual(result);
  try {
    assert.equal(actual.kind, entry.expected.kind);
    if (entry.expected.kind === 'json') {
      assert.deepEqual(stable(actual.value), stable(entry.expected.value));
    } else {
      assert.equal(actual.value, normalizeText(entry.expected.value));
    }
    return { pass: true };
  } catch (error) {
    return {
      pass: false,
      message: error instanceof Error ? error.message : String(error),
      actual,
    };
  }
}

function main() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const only = process.env.CODE_GRAPH_REGRESSION_ONLY;
  const entries = only
    ? fixture.entries.filter(
        (entry) => entry.id === only || entry.taskId === only,
      )
    : fixture.entries;

  if (entries.length === 0) {
    throw new Error(`No regression entries matched ${only}`);
  }

  const failures = [];
  for (const entry of entries) {
    const result = runCase(entry);
    if (result.pass) {
      console.log(`PASS ${entry.id} ${entry.taskId}`);
      continue;
    }

    failures.push({ entry, result });
    console.error(`FAIL ${entry.id} ${entry.taskId}`);
    console.error(`  source: ${entry.source}`);
    console.error(`  query: ${entry.cypher}`);
    console.error(`  reason: ${result.message}`);
    if (result.actual) {
      console.error(`  actual: ${JSON.stringify(result.actual, null, 2)}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length}/${entries.length} code-graph regression case(s) failed.`,
    );
    process.exit(1);
  }

  console.log(`\n${entries.length} code-graph regression case(s) passed.`);
}

main();
