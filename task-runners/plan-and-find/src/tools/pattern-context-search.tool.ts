import { tool } from 'langchain';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

type PatternIndexEntry = {
  id: string;
  aliases?: string[];
  tags?: string[];
  constraints?: string[];
  contextPath: string;
};

type PatternIndex = {
  model: string;
  builtAt: string;
  entries: PatternIndexEntry[];
};

const splitWords = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const singularize = (value: string): string =>
  value.endsWith('s') ? value.slice(0, -1) : value;

const scoreEntry = (query: string, entry: PatternIndexEntry): number => {
  const queryRaw = query.trim().toLowerCase();
  const queryWords = splitWords(queryRaw).map(singularize);
  const id = entry.id.toLowerCase();

  let score = 0;
  if (queryRaw === id || singularize(queryRaw) === id) {
    score += 100;
  }

  const aliases = (entry.aliases ?? []).map((a) => a.toLowerCase());
  if (aliases.includes(queryRaw)) {
    score += 50;
  }

  const bag = new Set<string>([
    ...splitWords(entry.id),
    ...(entry.tags ?? []).flatMap(splitWords),
    ...aliases.flatMap(splitWords),
  ]);

  for (const word of queryWords) {
    if (bag.has(word)) {
      score += 8;
    }
  }

  if (queryRaw.includes(id)) {
    score += 20;
  }

  return score;
};

export function createPatternContextSearchTool(options: { cwd?: string } = {}) {
  const cwd = options.cwd ?? process.cwd();
  const indexPath = path.join(cwd, '.code-graph', 'patterns', 'index.json');

  return tool(
    async ({
      queryKeywords,
      topK,
      threshold,
    }: {
      queryKeywords?: string[];
      topK: number;
      threshold: number;
    }) => {
      const raw = await readFile(indexPath, 'utf8');
      const index = JSON.parse(raw) as PatternIndex;
      const normalizedKeywords = (queryKeywords ?? [])
        .map((k) => k.trim())
        .filter(Boolean);
      const sourceQuery = normalizedKeywords.join(' ');
      if (!sourceQuery.length) {
        throw new Error(
          'search_pattern_context requires either queryKeywords or query.'
        );
      }

      const scored = index.entries
        .map((entry) => ({ entry, score: scoreEntry(sourceQuery, entry) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      const maxScore = scored[0]?.score ?? 0;
      const minScore = maxScore * threshold;
      const ranked = scored
        .filter((item) => item.score >= minScore)
        .slice(0, topK);

      const matches = await Promise.all(
        ranked.map(async ({ entry, score }) => {
          const contextFilePath = path.join(cwd, entry.contextPath);
          const contextMarkdown = await readFile(contextFilePath, 'utf8');
          return {
            id: entry.id,
            score,
            constraints: entry.constraints ?? [],
            contextPath: entry.contextPath,
            contextMarkdown,
          };
        })
      );

      const payload = {
        queryKeywords: normalizedKeywords,
        sourceQuery,
        threshold,
        scoreThreshold: minScore,
        topScore: maxScore,
        totalMatches: matches.length,
        matches,
      };
      console.log(
        '[tool] search_pattern_context:',
        matches.map((m) => `${m.id}: ${m.score}`).join(', ')
      );
      return JSON.stringify(payload, null, 2);
    },
    {
      name: 'search_pattern_context',
      description:
        'Semantic lookup for singular pattern IDs (e.g. service, model) using query keywords or natural-language query; returns intent, score, constraints, and markdown context chunks. Drops matches below threshold times the top score (0-1) before applying topK.',
      schema: z
        .object({
          queryKeywords: z
            .array(z.string().min(1))
            .max(30)
            .optional()
            .describe(
              'Optional keyword list mapped from catalog ids/tags/aliases.'
            ),
          topK: z
            .number()
            .int()
            .min(1)
            .max(5)
            .default(2)
            .describe('Maximum number of matched pattern contexts to return.'),
          threshold: z
            .number()
            .min(0)
            .max(1)
            .default(0.5)
            .describe(
              'Keep only matches with score >= threshold × best match score (0-1). Default 0.5 excludes weak tail matches.'
            ),
        })
        .refine((v) => (v.queryKeywords?.length ?? 0) > 0, {
          message: 'Provide queryKeywords.',
          path: ['queryKeywords'],
        }),
    }
  );
}
