import { tool } from 'langchain';
import { execFile, type ExecFileException } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

type CodeGraphQueryToolOptions = {
  cwd?: string;
  timeoutMs?: number;
};

/**
 * Creates a dedicated `code-graph query` tool that executes Cypher directly.
 * This allows the agent to avoid shell-indirection via the generic execute tool.
 */
export function createCodeGraphQueryTool(
  options: CodeGraphQueryToolOptions = {}
) {
  const cwd = options.cwd ?? process.cwd();
  const timeoutMs = options.timeoutMs ?? 30_000;

  return tool(
    async ({ cypher }: { cypher: string }) => {
      try {
        const { stdout, stderr } = await execFileAsync(
          'code-graph',
          ['query', cypher],
          {
            cwd,
            timeout: timeoutMs,
            maxBuffer: 10 * 1024 * 1024,
          }
        );

        if (stderr && stderr.trim().length > 0) {
          return `${stdout}\n[stderr] ${stderr}`.trim();
        }
        return stdout.trim();
      } catch (error) {
        const err = error as ExecFileException & {
          stdout?: string;
          stderr?: string;
        };
        const details = [
          err.message,
          err.stdout ? `stdout: ${err.stdout}` : '',
          err.stderr ? `stderr: ${err.stderr}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        // throw new Error(`code-graph query failed:\n${details}`);
        return `ERROR: code-graph query failed:\n${details}\n\nFix the query and retry.`;
      }
    },
    {
      name: 'code-graph-query',
      description:
        'Execute a code-graph Cypher query and return raw JSON/string output.',
      schema: z.object({
        cypher: z
          .string()
          .describe(
            'Cypher query string, beginning with MATCH and including RETURN.'
          ),
      }),
    }
  );
}
