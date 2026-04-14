#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function usage() {
  console.log(
    [
      'Usage: node scripts/response-to-markdown.js [input.json] [output.md] [options]',
      '',
      'Options:',
      '  --show-raw-tools   Include raw tool output JSON (default: hidden)',
      '  -h, --help         Show this help message',
    ].join('\n')
  );
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function messageKind(message) {
  const id = message?.id;
  if (Array.isArray(id) && id.length > 0) {
    return String(id[id.length - 1]);
  }
  return '';
}

function formatContent(content) {
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
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function summarizeToolOutput(content) {
  const parsed = parseMaybeJson(content);

  if (Array.isArray(parsed)) {
    return `${parsed.length} row(s) returned`;
  }

  if (parsed && typeof parsed === 'object') {
    const notes = [];
    if (typeof parsed.totalMatches === 'number') {
      notes.push(`${parsed.totalMatches} match(es)`);
    }
    if (typeof parsed.totalPatterns === 'number') {
      notes.push(`${parsed.totalPatterns} pattern(s)`);
    }
    if (Array.isArray(parsed.matches)) {
      notes.push(`${parsed.matches.length} match row(s)`);
    }
    if (Array.isArray(parsed.ids)) {
      notes.push(`${parsed.ids.length} id(s)`);
    }
    if (Array.isArray(parsed.tags)) {
      notes.push(`${parsed.tags.length} tag(s)`);
    }

    if (notes.length > 0) return notes.join(', ');
    return `${Object.keys(parsed).length} field(s) returned`;
  }

  if (typeof content === 'string' && content.trim().length > 0) {
    return 'text response returned';
  }
  return 'no output';
}

function toJsonCodeBlock(value) {
  return [
    '```json',
    JSON.stringify(value, null, 2).replace(/```/g, '\\`\\`\\`'),
    '```',
  ].join('\n');
}

function firstSentence(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const idx = normalized.search(/[.!?]/);
  if (idx === -1) return normalized;
  return normalized.slice(0, idx + 1);
}

function splitRuns(messages) {
  const runs = [];
  let current = [];

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
}

function buildRunSummary(runMessages, options) {
  const stages = [];
  const finalAssistantMessages = [];
  const allToolEntries = [];
  let stageCounter = 0;

  function createStage(reasoning) {
    stageCounter += 1;
    return {
      index: stageCounter,
      reasoning,
      tools: [],
      toolCallMap: new Map(),
    };
  }

  for (const msg of runMessages) {
    const kind = messageKind(msg);
    const kwargs = msg?.kwargs || {};
    const content = formatContent(kwargs.content);

    if (kind === 'AIMessage') {
      const toolCalls = Array.isArray(kwargs.tool_calls)
        ? kwargs.tool_calls
        : [];
      if (toolCalls.length > 0) {
        const stage = createStage(firstSentence(content));
        for (const tc of toolCalls) {
          const entry = {
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
          allToolEntries.push(entry);
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
        const fallbackEntry = {
          id: toolCallId,
          name: toolName,
          status,
          summary,
          raw: parseMaybeJson(content) ?? content,
        };
        fallbackStage.tools.push(fallbackEntry);
      }
    }
  }

  const finalAnswer =
    finalAssistantMessages[finalAssistantMessages.length - 1] || '';
  const totalTools = stages.reduce((acc, stage) => acc + stage.tools.length, 0);

  const lines = [];

  stages.forEach((stage) => {
    lines.push(`## Stage ${stage.index}`);
    if (stage.reasoning) {
      lines.push(`- Reasoning: ${stage.reasoning}`);
    }
    lines.push(`- Tool calls: ${stage.tools.length}`);
    stage.tools.forEach((tool) => {
      lines.push(
        `  - \`${tool.name}\` -> \`${tool.status}\` (${tool.summary})`
      );
      if (options.showRawTools) {
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
}

function buildMarkdown(data, inputPath, options) {
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const lines = [];
  lines.push('# Agent Response');
  lines.push('');
  // lines.push(`Input: \`${path.basename(inputPath)}\``);
  // lines.push('');

  if (messages.length === 0) {
    lines.push('_No messages found._');
    return lines.join('\n');
  }

  const runs = splitRuns(messages);
  runs.forEach((run, i) => {
    lines.push(buildRunSummary(run, options));
    if (i !== runs.length - 1) {
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  });

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const showRawTools = args.includes('--show-raw-tools');
  const positionalArgs = args.filter((arg) => !arg.startsWith('-'));

  if (process.argv.includes('-h') || process.argv.includes('--help')) {
    usage();
    process.exit(0);
  }

  const resolvedInputPath = path.resolve(
    process.cwd(),
    positionalArgs[0] || 'response.json'
  );
  const resolvedOutputPath = path.resolve(
    process.cwd(),
    positionalArgs[1] || 'RESPONSE.md'
  );

  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`Input file not found: ${resolvedInputPath}`);
    process.exit(1);
  }

  const data = readJson(resolvedInputPath);
  const markdown = buildMarkdown(data, resolvedInputPath, { showRawTools });
  fs.writeFileSync(resolvedOutputPath, `${markdown}\n`, 'utf8');

  console.log(`Wrote ${path.relative(process.cwd(), resolvedOutputPath)}`);
}

main();
