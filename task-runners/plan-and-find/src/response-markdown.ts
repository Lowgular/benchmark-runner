import { readFileSync, writeFileSync } from 'fs';

type Message = {
  id?: unknown;
  kwargs?: {
    content?: unknown;
    tool_calls?: Array<{ id?: string; name?: string }>;
    tool_call_id?: string;
    name?: string;
    status?: string;
  };
};

type AgentResult = {
  messages?: Message[];
};

type ToolEntry = {
  id: string;
  name: string;
  status: string;
  summary: string;
  raw: unknown;
};

type Stage = {
  index: number;
  reasoning: string;
  tools: ToolEntry[];
  toolCallMap: Map<string, ToolEntry>;
};

const messageKind = (message: Message): string => {
  const id = message?.id;
  if (Array.isArray(id) && id.length > 0) {
    return String(id[id.length - 1]);
  }
  return '';
};

const formatContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (
          entry &&
          typeof entry === 'object' &&
          'text' in entry &&
          typeof entry.text === 'string'
        ) {
          return entry.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (content == null) return '';
  return String(content).trim();
};

const parseMaybeJson = (value: unknown): unknown | null => {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const summarizeToolOutput = (content: string): string => {
  const parsed = parseMaybeJson(content);

  if (Array.isArray(parsed)) {
    return `${parsed.length} row(s) returned`;
  }

  if (parsed && typeof parsed === 'object') {
    const notes: string[] = [];
    const parsedObj = parsed as Record<string, unknown>;

    if (typeof parsedObj.totalMatches === 'number') {
      notes.push(`${parsedObj.totalMatches} match(es)`);
    }
    if (typeof parsedObj.totalPatterns === 'number') {
      notes.push(`${parsedObj.totalPatterns} pattern(s)`);
    }
    if (Array.isArray(parsedObj.matches)) {
      notes.push(`${parsedObj.matches.length} match row(s)`);
    }
    if (Array.isArray(parsedObj.ids)) {
      notes.push(`${parsedObj.ids.length} id(s)`);
    }
    if (Array.isArray(parsedObj.tags)) {
      notes.push(`${parsedObj.tags.length} tag(s)`);
    }

    if (notes.length > 0) return notes.join(', ');
    return `${Object.keys(parsedObj).length} field(s) returned`;
  }

  if (content.trim().length > 0) {
    return 'text response returned';
  }
  return 'no output';
};

const toJsonCodeBlock = (value: unknown): string => {
  return [
    '```json',
    JSON.stringify(value, null, 2).replace(/```/g, '\\`\\`\\`'),
    '```',
  ].join('\n');
};

const firstSentence = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const idx = normalized.search(/[.!?]/);
  if (idx === -1) return normalized;
  return normalized.slice(0, idx + 1);
};

const splitRuns = (messages: Message[]): Message[][] => {
  const runs: Message[][] = [];
  let current: Message[] = [];

  for (const msg of messages) {
    if (messageKind(msg) === 'HumanMessage' && current.length > 0) {
      runs.push(current);
      current = [];
    }
    current.push(msg);
  }

  if (current.length > 0) {
    runs.push(current);
  }
  return runs;
};

const buildRunSummary = (
  runMessages: Message[],
  showRawTools: boolean
): string => {
  const stages: Stage[] = [];
  const finalAssistantMessages: string[] = [];
  let stageCounter = 0;

  const createStage = (reasoning: string): Stage => {
    stageCounter += 1;
    return {
      index: stageCounter,
      reasoning,
      tools: [],
      toolCallMap: new Map(),
    };
  };

  for (const msg of runMessages) {
    const kind = messageKind(msg);
    const kwargs = msg?.kwargs ?? {};
    const content = formatContent(kwargs.content);

    if (kind === 'AIMessage') {
      const toolCalls = Array.isArray(kwargs.tool_calls) ? kwargs.tool_calls : [];
      if (toolCalls.length > 0) {
        const stage = createStage(firstSentence(content));
        for (const tc of toolCalls) {
          const entry: ToolEntry = {
            id: tc?.id || '',
            name: tc?.name || 'unknown_tool',
            status: 'pending',
            summary: 'awaiting result',
            raw: null,
          };
          stage.tools.push(entry);
          if (entry.id) {
            stage.toolCallMap.set(entry.id, entry);
          }
        }
        stages.push(stage);
      } else if (content) {
        finalAssistantMessages.push(content);
      }
      continue;
    }

    if (kind === 'ToolMessage') {
      const toolCallId = kwargs.tool_call_id || '';
      const toolName = kwargs.name || 'tool';
      const status = kwargs.status || 'unknown';
      const summary = summarizeToolOutput(content);

      let attached = false;
      for (let i = stages.length - 1; i >= 0; i -= 1) {
        const stage = stages[i];
        const byId = toolCallId ? stage.toolCallMap.get(toolCallId) : null;
        if (byId) {
          byId.status = status;
          byId.summary = summary;
          byId.raw = parseMaybeJson(content) ?? content;
          attached = true;
          break;
        }
      }

      if (!attached) {
        const fallbackStage =
          stages[stages.length - 1] || createStage('Tool execution stage.');
        if (stages.length === 0) stages.push(fallbackStage);
        fallbackStage.tools.push({
          id: toolCallId,
          name: toolName,
          status,
          summary,
          raw: parseMaybeJson(content) ?? content,
        });
      }
    }
  }

  const finalAnswer =
    finalAssistantMessages[finalAssistantMessages.length - 1] || '';
  const totalTools = stages.reduce((acc, stage) => acc + stage.tools.length, 0);
  const lines: string[] = [];

  stages.forEach((stage) => {
    lines.push(`## Stage ${stage.index}`);
    if (stage.reasoning) {
      lines.push(`- Reasoning: ${stage.reasoning}`);
    }
    lines.push(`- Tool calls: ${stage.tools.length}`);
    stage.tools.forEach((tool) => {
      lines.push(`  - \`${tool.name}\` -> \`${tool.status}\` (${tool.summary})`);
      if (showRawTools) {
        lines.push('');
        lines.push('    <details>');
        lines.push('    <summary>Raw tool output</summary>');
        lines.push('');
        lines.push(
          toJsonCodeBlock(tool.raw)
            .split('\n')
            .map((line) => `    ${line}`)
            .join('\n')
        );
        lines.push('');
        lines.push('    </details>');
      }
    });
    lines.push('');
  });

  lines.push('## Final Answer');
  lines.push('');
  lines.push(`- Stages: ${stages.length}`);
  lines.push(`- Tools used: ${totalTools}`);
  lines.push('');
  lines.push(finalAnswer || '_[no final assistant text found]_');
  lines.push('');

  return lines.join('\n');
};

const buildMarkdown = (data: AgentResult, showRawTools: boolean): string => {
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const lines: string[] = [];
  lines.push('# Agent Response');
  lines.push('');

  if (messages.length === 0) {
    lines.push('_No messages found._');
    return lines.join('\n');
  }

  const runs = splitRuns(messages);
  runs.forEach((run, index) => {
    lines.push(buildRunSummary(run, showRawTools));
    if (index !== runs.length - 1) {
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  });

  return lines.join('\n');
};

const readLastJsonlEntry = (inputPath: string): AgentResult => {
  const raw = readFileSync(inputPath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`JSONL file is empty: ${inputPath}`);
  }
  return JSON.parse(lines[lines.length - 1]) as AgentResult;
};

export const writeResponseMarkdownFromJsonl = (input: {
  inputPath: string;
  outputPath?: string;
  showRawTools?: boolean;
}): void => {
  const data = readLastJsonlEntry(input.inputPath);
  const markdown = buildMarkdown(data, input.showRawTools ?? false);
  const outputPath = input.outputPath ?? 'RESPONSE.md';
  writeFileSync(outputPath, `${markdown}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
};
