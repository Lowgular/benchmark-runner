import { tool } from "langchain";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

type CypherContextIndexEntry = {
  id: string;
  aliases?: string[];
  tags?: string[];
  contextPath: string;
};

type CypherContextIndex = {
  builtAt: string;
  entries: CypherContextIndexEntry[];
};

const splitWords = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const scoreEntry = (
  needles: string[],
  entry: CypherContextIndexEntry,
): number => {
  const id = entry.id.toLowerCase();
  const aliases = (entry.aliases ?? []).map((a) => a.toLowerCase());
  const tags = (entry.tags ?? []).map((t) => t.toLowerCase());
  const normalizedNeedles = needles
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => n.toLowerCase());

  let score = 0;
  for (const needle of normalizedNeedles) {
    if (needle === id) score += 140;
    if (aliases.includes(needle)) score += 90;
    if (tags.includes(needle)) score += 70;

    if (needle.includes(id) && needle !== id) score += 35;
    for (const alias of aliases) {
      if (needle.includes(alias) && needle !== alias) score += 20;
    }
    for (const tag of tags) {
      if (needle.includes(tag) && needle !== tag) score += 15;
    }
  }

  const bag = new Set<string>([
    ...splitWords(entry.id),
    ...(entry.tags ?? []).flatMap(splitWords),
    ...aliases.flatMap(splitWords),
  ]);

  const needleWords = new Set(normalizedNeedles.flatMap(splitWords));
  for (const word of needleWords) {
    if (bag.has(word)) score += 8;
  }

  return score;
};

export function createCypherContextSearchTool(options: { cwd?: string } = {}) {
  const cwd = options.cwd ?? process.cwd();
  const indexPath = path.join(cwd, ".code-graph", "cypher", "index.json");

  return tool(
    async ({ needles, topK }: { needles: string[]; topK: number }) => {
      const raw = await readFile(indexPath, "utf8");
      const index = JSON.parse(raw) as CypherContextIndex;

      const ranked = index.entries
        .map((entry) => ({
          entry,
          score: scoreEntry(needles, entry),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      const matches = await Promise.all(
        ranked.map(async ({ entry, score }) => {
          const contextFilePath = path.join(cwd, entry.contextPath);
          const contextMarkdown = await readFile(contextFilePath, "utf8");
          return {
            id: entry.id,
            score,
            contextPath: entry.contextPath,
            contextMarkdown,
          };
        }),
      );

      const payload = {
        needles,
        totalMatches: matches.length,
        matches,
      };

      console.log(
        "[tool] search_cypher_context:",
        matches.map((m) => `${m.id}: ${m.score}`).join(", "),
      );
      return JSON.stringify(payload, null, 2);
    },
    {
      name: "search_cypher_context",
      description:
        "Lookup minimal Cypher/schema guidance chunks (with examples) using known ids/tags/aliases as retrieval signals.",
      schema: z.object({
        needles: z
          .array(z.string().min(1))
          .min(1)
          .max(32)
          .describe(
            "Known ids, aliases, and/or tags to use for retrieval. (No raw user query text.)",
          ),
        topK: z
          .number()
          .int()
          .min(1)
          .max(4)
          .default(2)
          .describe("Maximum number of Cypher context chunks to return."),
      }),
    },
  );
}
