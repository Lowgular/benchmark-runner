const fs = require('fs');
const path = require('path');

const runnerRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(runnerRoot, '../..');
const runsRoot = path.join(workspaceRoot, 'runs', 'agent-code-graph');
const outputPath = path.join(
  runnerRoot,
  'regression',
  'code-graph-queries.json',
);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(filePath, out);
    } else if (entry.name === 'agents.jsonl') {
      out.push(filePath);
    }
  }
  return out;
}

function readLastJsonLine(filePath) {
  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;
  return JSON.parse(lines[lines.length - 1]);
}

function normalizeExpected(content) {
  const trimmed = String(content ?? '').trim();
  if (trimmed.startsWith('[')) {
    return { kind: 'json', value: JSON.parse(trimmed) };
  }

  return { kind: 'text', value: trimmed };
}

function extractEntries(filePath, json) {
  const messages = json.messages ?? [];
  const responsesByToolCallId = new Map();

  for (const message of messages) {
    const kwargs = message.kwargs ?? {};
    if (kwargs.name !== 'code-graph-query') continue;
    if (!kwargs.tool_call_id) continue;
    responsesByToolCallId.set(kwargs.tool_call_id, kwargs.content ?? '');
  }

  const entries = [];
  for (const message of messages) {
    const kwargs = message.kwargs ?? {};
    const toolCalls = kwargs.tool_calls ?? [];
    for (const toolCall of toolCalls) {
      if (toolCall.name !== 'code-graph-query') continue;

      const id = toolCall.id;
      const cypher = toolCall.args?.cypher;
      if (!id || typeof cypher !== 'string') continue;

      const response = responsesByToolCallId.get(id);
      if (response === undefined) continue;

      const relativeAgentsPath = path.relative(workspaceRoot, filePath);
      entries.push({
        id: `${entries.length + 1}`,
        source: relativeAgentsPath,
        taskId: relativeAgentsPath.split(path.sep)[2] ?? 'unknown',
        toolCallId: id,
        cypher,
        expected: normalizeExpected(response),
      });
    }
  }

  return entries;
}

function main() {
  const entries = [];
  for (const agentsPath of walk(runsRoot).sort()) {
    const json = readLastJsonLine(agentsPath);
    if (!json) continue;
    for (const entry of extractEntries(agentsPath, json)) {
      entry.id = String(entries.length + 1).padStart(3, '0');
      entries.push(entry);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runsRoot: path.relative(runnerRoot, runsRoot),
        targetWorkspace: path.relative(
          runnerRoot,
          path.join(workspaceRoot, 'init-states', 'angular-nest-team-crud'),
        ),
        count: entries.length,
        entries,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`Wrote ${entries.length} regression case(s) to ${outputPath}`);
}

main();
