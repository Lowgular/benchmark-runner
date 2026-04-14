import { tool } from 'langchain';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

type PatternIndexEntry = {
  id: string;
  aliases?: string[];
  tags?: string[];
  contextPath: string;
};

type PatternIndex = {
  model: string;
  builtAt: string;
  entries: PatternIndexEntry[];
};

const uniqueSorted = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

export function createListPatternCatalogTool(options: { cwd?: string } = {}) {
  const cwd = options.cwd ?? process.cwd();
  const indexPath = path.join(cwd, '.code-graph', 'patterns', 'index.json');

  return tool(
    async () => {
      const raw = await readFile(indexPath, 'utf8');
      const index = JSON.parse(raw) as PatternIndex;

      const ids = uniqueSorted(index.entries.map((e) => e.id));
      const tags = uniqueSorted(index.entries.flatMap((e) => e.tags ?? []));
      const aliases = uniqueSorted(
        index.entries.flatMap((e) => e.aliases ?? [])
      );

      const payload = {
        model: index.model,
        builtAt: index.builtAt,
        totalPatterns: index.entries.length,
        ids,
        tags,
        aliases,
      };

      console.log(
        `[tool] list_pattern_catalog: ${ids.length} ids, ${tags.length} tags`
      );
      return JSON.stringify(payload, null, 2);
    },
    {
      name: 'list_pattern_catalog',
      description:
        'Return available pattern catalog vocabulary: ids, tags, aliases, constraints.',
      schema: z.object({}),
    }
  );
}
