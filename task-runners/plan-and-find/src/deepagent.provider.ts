import type { SubAgent } from 'deepagents';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function resolveAgentsMdPath(filePath: string, cwd: string): string {
  const absolute = resolve(cwd, filePath);
  if (!existsSync(absolute)) {
    throw new Error(
      `Agent file not found: ${absolute}\n(resolved from cwd: ${cwd}, path: ${filePath})`
    );
  }
  return absolute;
}

function unquoteYamlScalar(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'") && s[s.length - 1] === q) {
      return s.slice(1, -1);
    }
  }
  return s;
}

function splitToolNamesScalar(raw: string): string[] {
  return raw
    .split(/[,\s|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Reads tool allowlists from AGENTS.md frontmatter.
 *
 * - **`tools:`** — Preferred. Inline (`tools: a, b`) or YAML list (`tools:` then `  - id` lines).
 * - **`allowed-tools:`** — [Agent Skills](https://agent-config.com/guides/agent-skills-standard/)-style
 *   space- or comma-separated names (also used in Claude Code skill/command frontmatter).
 *
 * Deep Agents (LangChain) documents per-subagent `tools` lists explicitly in code; this maps the same
 * idea into markdown for this runner.
 */
function parseToolsFromFrontmatter(frontmatter: string): string[] {
  const lines = frontmatter.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const toolsMatch = /^tools:\s*(.*)$/i.exec(lines[i]);
    if (!toolsMatch) continue;
    const rest = toolsMatch[1].trim();
    if (rest.length) {
      return splitToolNamesScalar(rest);
    }
    const items: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      if (lines[j].trim() === '') {
        j++;
        continue;
      }
      const item = /^\s+-\s+(.+)$/.exec(lines[j]);
      if (item) {
        items.push(unquoteYamlScalar(item[1]));
        j++;
      } else {
        break;
      }
    }
    if (!items.length) {
      throw new Error(
        'AGENTS.md frontmatter: `tools:` must list at least one tool (YAML list or inline names)'
      );
    }
    return items;
  }
  const allowed = /^allowed-tools:\s*(.+)$/im.exec(frontmatter)?.[1]?.trim();
  if (allowed?.length) {
    return splitToolNamesScalar(allowed);
  }
  throw new Error(
    'AGENTS.md frontmatter must declare `tools:` (YAML list or inline) or `allowed-tools:` (space-separated).'
  );
}

function parseAgentsMdFrontmatterAndBody(raw: string): {
  name: string;
  description: string;
  pipelineId: string;
  tools: string[];
  model?: string;
  systemPrompt: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(
      'AGENTS.md must begin with YAML frontmatter delimited by --- lines'
    );
  }
  const [, frontmatter, body] = match;
  const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  const description = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  const model = /^model:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  const pipelineIdRaw = /^pipelineId:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  if (!name?.length || !description?.length) {
    throw new Error(
      'AGENTS.md frontmatter must include non-empty name: and description:'
    );
  }
  if (!pipelineIdRaw?.length) {
    throw new Error(
      'AGENTS.md frontmatter must include non-empty pipelineId:'
    );
  }
  const pipelineId = unquoteYamlScalar(pipelineIdRaw);
  if (!pipelineId.length) {
    throw new Error(
      'AGENTS.md frontmatter must include non-empty pipelineId:'
    );
  }
  const tools = parseToolsFromFrontmatter(frontmatter);
  return {
    name,
    description,
    pipelineId,
    tools,
    model: model?.length ? model : undefined,
    systemPrompt: body.trim(),
  };
}

/**
 * Sub-agent loaded from AGENTS.md. `tools` are allowlist strings from frontmatter (`tools:` / `allowed-tools:`).
 * {@link SubAgent} also has `tools` for bound LangChain tools; this type replaces that field with string ids for the runner.
 */
export type LoadedSubAgent = Omit<SubAgent, 'tools'> & {
  pipelineId: string;
  tools: string[];
};

export type ProvideSubAgentOptions = Partial<SubAgent> & {
  /** Base directory for resolving relative `filePath` (default `process.cwd()`). */
  cwd?: string;
};

/**
 * Load a {@link SubAgent} from the given AGENTS.md path, resolved relative to `cwd`.
 */
export function provideSubAgent(
  filePath: string,
  options: ProvideSubAgentOptions = {}
): LoadedSubAgent {
  const { cwd = process.cwd(), ...subAgentOverrides } = options;
  const agentsPath = resolveAgentsMdPath(filePath, cwd);
  const parsed = parseAgentsMdFrontmatterAndBody(
    readFileSync(agentsPath, 'utf-8')
  );
  const sub: LoadedSubAgent = {
    ...subAgentOverrides,
    name: parsed.name,
    description: parsed.description,
    systemPrompt: parsed.systemPrompt,
    pipelineId: parsed.pipelineId,
    tools: parsed.tools,
  };
  return sub;
}
