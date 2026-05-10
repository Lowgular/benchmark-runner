#!/usr/bin/env bun
import { query } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// runner is at <repo>/task-runners/plan-and-find-claude-qmd/src/main.ts
const RUNNER_DIR = resolve(HERE, '..');
const REPO_ROOT = resolve(RUNNER_DIR, '..', '..');
const AGENTS_ROOT = resolve(REPO_ROOT, '..');

const DEFAULT_MCP_SERVER_PATH = resolve(
  AGENTS_ROOT,
  'code-graph',
  'apps',
  'mcp',
  'code-graph-qmd',
  'src',
  'server.ts',
);
const DEFAULT_KB_DIR = resolve(AGENTS_ROOT, 'code-graph', 'libs', 'kb', 'code-graph');

const MCP_SERVER_PATH = process.env.AGENTS_MCP_PATH ?? DEFAULT_MCP_SERVER_PATH;
const KB_DIR = process.env.MCP_KB_DIR ?? DEFAULT_KB_DIR;
const MCP_SERVER_NAME = 'code-graph';
const MCP_TOOLS = new Set(['nl2intent', 'intent2cypher', 'code-graph-query']);

const MODEL_ALIASES: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

function resolveModel(input: string): string {
  return MODEL_ALIASES[input.toLowerCase()] ?? input;
}

interface AgentDef {
  name: string;
  description: string;
  tools: string[];
  body: string;
}

function parseAgentFile(filePath: string): AgentDef {
  const content = readFileSync(filePath, 'utf8');
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fm) throw new Error(`No YAML frontmatter found in ${filePath}`);
  const [, frontmatter = '', body = ''] = fm;
  const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim() ?? '';
  const description = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim() ?? '';
  const toolsBlock = /^tools:\s*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/m.exec(frontmatter);
  const tools = toolsBlock?.[1]
    ? toolsBlock[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^[ \t]+-[ \t]+/, '').trim())
        .filter(Boolean)
    : [];
  return { name, description, tools, body: body.trim() };
}

function buildAllowedTools(agentDef: AgentDef): string[] {
  const out: string[] = [];
  for (const t of agentDef.tools) {
    if (MCP_TOOLS.has(t)) {
      out.push(`mcp__${MCP_SERVER_NAME}__${t}`);
    } else {
      out.push(t);
    }
  }
  if (agentDef.name === 'bash') out.push('Bash');
  return out;
}

function parseCliArgs(): {
  promptFile: string;
  initStateDir: string;
  agentFile: string;
  modelName: string;
} {
  const [, , promptFile, initStateDir, agentFile, modelName] = process.argv;
  const missing: string[] = [];
  if (!promptFile) missing.push('prompt-file');
  if (!initStateDir) missing.push('init-state-dir');
  if (!agentFile) missing.push('agent-file');
  if (!modelName) missing.push('model-name');
  if (missing.length) {
    console.error(`Missing args: ${missing.join(', ')}`);
    console.error(
      'Usage: bun run src/main.ts <prompt-file> <init-state-dir> <agent-file> <model-name>',
    );
    process.exit(1);
  }
  return {
    promptFile: promptFile!,
    initStateDir: initStateDir!,
    agentFile: agentFile!,
    modelName: modelName!,
  };
}

interface ToolCallRecord {
  name: string;
  input: unknown;
}

async function main(): Promise<void> {
  const args = parseCliArgs();
  const promptPath = resolve(args.promptFile);
  const initStateAbs = resolve(args.initStateDir);
  const agentPath = resolve(args.agentFile);

  if (!existsSync(promptPath)) throw new Error(`Prompt not found: ${promptPath}`);
  if (!existsSync(initStateAbs)) throw new Error(`Init state not found: ${initStateAbs}`);
  if (!existsSync(agentPath)) throw new Error(`Agent file not found: ${agentPath}`);
  if (!existsSync(MCP_SERVER_PATH))
    throw new Error(
      `MCP server not found at ${MCP_SERVER_PATH}. Set AGENTS_MCP_PATH env var to override.`,
    );
  if (!existsSync(KB_DIR))
    throw new Error(`KB dir not found at ${KB_DIR}. Set MCP_KB_DIR env var to override.`);

  const taskPrompt = readFileSync(promptPath, 'utf8');
  const agentDef = parseAgentFile(agentPath);
  const taskId = parse(promptPath).name;
  const allowedTools = buildAllowedTools(agentDef);
  const taskRunId = randomUUID();
  const resolvedModel = resolveModel(args.modelName);
  const startedAt = Date.now();

  console.error(`taskId           : ${taskId}`);
  console.error(`taskRunId        : ${taskRunId}`);
  console.error(`init state       : ${initStateAbs}  (project cwd, untouched)`);
  console.error(`kb dir           : ${KB_DIR}`);
  console.error(`agent            : ${agentDef.name} (${agentDef.tools.length} tools)`);
  console.error(
    `model            : ${resolvedModel}${args.modelName !== resolvedModel ? ` (alias: ${args.modelName})` : ''}`,
  );
  console.error(`allowedTools     : ${allowedTools.join(', ')}`);
  console.error(`mcp server       : ${MCP_SERVER_PATH}`);
  console.error('');

  const result = query({
    prompt: taskPrompt,
    options: {
      cwd: initStateAbs,
      systemPrompt: agentDef.body,
      model: resolvedModel,
      permissionMode: 'bypassPermissions',
      allowedTools,
      mcpServers: {
        [MCP_SERVER_NAME]: {
          type: 'stdio',
          command: 'bun',
          args: ['run', MCP_SERVER_PATH],
          env: {
            ...(process.env as Record<string, string>),
            MCP_KB_DIR: KB_DIR,
            MCP_PROJECT_DIR: initStateAbs,
          },
        },
      },
    },
  });

  let finalAssistantText = '';
  const toolCalls: ToolCallRecord[] = [];

  for await (const msg of result) {
    if (msg.type === 'assistant') {
      const content = msg.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            finalAssistantText = block.text;
          } else if (block.type === 'tool_use') {
            toolCalls.push({ name: block.name, input: block.input });
            console.error(`[tool_use] ${block.name}`);
          }
        }
      }
    } else if (msg.type === 'result') {
      console.error(`[result] subtype=${msg.subtype}`);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  writeFileSync('RESPONSE.md', `${finalAssistantText.trim()}\n`, 'utf8');

  const summary = {
    version: '1',
    results: [{ promptDef: { name: taskId, prompt: taskPrompt }, score: null }],
    details: {
      summary: {
        taskId,
        prompt: taskPrompt,
        taskRunId,
        environmentId: parse(initStateAbs).name,
        model: resolvedModel,
        runner: { id: 'claude-agent-sdk-qmd' },
        pipelineId: agentDef.name,
        elapsedMs,
        toolCalls,
      },
    },
  };
  writeFileSync('summary.json', `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.error(`\nDone in ${elapsedMs}ms. Wrote RESPONSE.md and summary.json to ${process.cwd()}`);
}

main().catch((err) => {
  console.error('Runner failed:', err);
  process.exit(1);
});
