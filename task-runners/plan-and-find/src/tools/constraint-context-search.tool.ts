import { tool } from 'langchain';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

type ConstraintIndexEntry = {
  id: string;
  aliases?: string[];
  contextPath: string;
};

type ConstraintIndex = {
  builtAt: string;
  entries: ConstraintIndexEntry[];
};

const splitWords = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const scoreEntryForKeyword = (
  keyword: string,
  entry: ConstraintIndexEntry
): number => {
  const keywordRaw = keyword.toLowerCase().trim();
  const id = entry.id.toLowerCase();
  const aliases = (entry.aliases ?? []).map((a) => a.toLowerCase());

  let score = 0;
  if (keywordRaw.length === 0) return 0;
  if (keywordRaw === id) score += 200;
  if (aliases.includes(keywordRaw)) score += 160;
  if (id.includes(keywordRaw) || keywordRaw.includes(id)) score += 90;

  const bag = new Set<string>([
    ...splitWords(entry.id),
    ...aliases.flatMap(splitWords),
  ]);

  for (const word of splitWords(keywordRaw)) {
    if (bag.has(word)) score += 24;
  }

  return score;
};

export function createConstraintContextSearchTool(
  options: { cwd?: string } = {}
) {
  const cwd = options.cwd ?? process.cwd();
  const indexPath = path.join(
    cwd,
    '.code-graph',
    'patterns',
    'constraints',
    'index.json'
  );

  return tool(
    async ({ constraintKeywords }: { constraintKeywords: string[] }) => {
      const raw = await readFile(indexPath, 'utf8');
      const index = JSON.parse(raw) as ConstraintIndex;
      const keywordMappings = await Promise.all(
        constraintKeywords.map(async (rawKeyword) => {
          const keyword = rawKeyword.trim();
          const best = index.entries
            .map((entry) => ({
              entry,
              score: scoreEntryForKeyword(keyword, entry),
            }))
            .sort((a, b) => b.score - a.score)[0];

          if (!best || best.score <= 0) {
            return {
              constraintKeyword: keyword,
              match: null,
            };
          }

          const contextFilePath = path.join(cwd, best.entry.contextPath);
          const contextMarkdown = await readFile(contextFilePath, 'utf8');
          return {
            constraintKeyword: keyword,
            match: {
              id: best.entry.id,
              score: best.score,
              contextPath: best.entry.contextPath,
              contextMarkdown,
            },
          };
        })
      );

      const payload = {
        constraintKeywords,
        totalKeywords: constraintKeywords.length,
        resolvedKeywords: keywordMappings.filter((m) => m.match !== null)
          .length,
        mappings: keywordMappings,
      };

      console.log(
        '[tool] search_constraint_context:',
        keywordMappings
          .map((m) =>
            m.match
              ? `${m.constraintKeyword}->${m.match.id}:${m.match.score}`
              : `${m.constraintKeyword}->none`
          )
          .join(', ')
      );
      return JSON.stringify(payload, null, 2);
    },
    {
      name: 'search_constraint_context',
      description:
        'Map each constraint keyword to one best matching constraint context chunk.',
      schema: z.object({
        constraintKeywords: z
          .array(z.string().min(1))
          .min(1)
          .max(20)
          .describe(
            'Constraint keywords to resolve. Tool returns exactly one best context match per keyword.'
          ),
      }),
    }
  );
}
