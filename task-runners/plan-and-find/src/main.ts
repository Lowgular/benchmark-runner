import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenRouter } from "@langchain/openrouter";
import { createDeepAgent, LocalShellBackend } from "deepagents";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { basename, parse, resolve } from "path";
import { provideSubAgent } from "./deepagent.provider";
import { createToolTraceMiddleware } from "./middleware/tool-trace.middleware";
import {
  buildOpenRouterUsageFromAgentResult,
  buildRunnerUsageSummary,
  logOpenRouterUsage,
} from "./response";
import { writeResponseMarkdownFromJsonl } from "./response-markdown";
import { createCodeGraphQueryTool } from "./tools/code-graph-query.tool";
import { createConstraintContextSearchTool } from "./tools/constraint-context-search.tool";
import { createCypherContextSearchTool } from "./tools/cypher-context-search.tool";
import { createListPatternCatalogTool } from "./tools/list-pattern-catalog.tool";
import { createPatternContextSearchTool } from "./tools/pattern-context-search.tool";
import {
  assertDirectoryExists,
  copyInitStateIntoWorkspace,
  emptyDirectoryInPlace,
  getTaskRunIdFromCwd,
} from "./workspace";

type CliArgs = {
  promptFilePath: string;
  /** Absolute or cwd-relative path to the init_state directory to copy into the workspace. */
  environmentFolderPath: string;
  agentFilePath: string;
  /** OpenRouter model id (e.g. z-ai/glm-5, anthropic/claude-sonnet-4). */
  modelName: string;
};

const usage = () => {
  console.log(
    [
      "Usage: node main.js <prompt-file-path> <init-state-folder> <agent-file-path> <model-name>",
      "",
      "Arguments:",
      "  prompt-file-path     Path to the task prompt file (relative to cwd or absolute)",
      "  init-state-folder    Path to init_state directory; its contents are copied into cwd after cwd is cleared",
      "  agent-file-path      Path to the AGENTS.md file to use",
      "  model-name           OpenRouter model id (e.g. z-ai/glm-5)",
      "",
      "cwd must be a folder whose name is a client-generated GUID (used as taskRunId for the backend).",
    ].join("\n"),
  );
};

const parseCliArgs = (): CliArgs => {
  const [, , promptFilePath, environmentFolderPath, agentFilePath, modelName] =
    process.argv;
  const normalizedPromptFilePath = promptFilePath?.trim() ?? "";
  const normalizedEnvironmentFolderPath = environmentFolderPath?.trim() ?? "";
  const normalizedAgentFilePath = agentFilePath?.trim() ?? "";
  const normalizedModelName = modelName?.trim() ?? "";

  const missing: string[] = [];
  if (!normalizedPromptFilePath) missing.push("prompt-file-path");
  if (!normalizedEnvironmentFolderPath) missing.push("init-state-folder");
  if (!normalizedAgentFilePath) missing.push("agent-file-path");
  if (!normalizedModelName) missing.push("model-name");

  if (missing.length > 0) {
    usage();
    throw new Error(
      `Missing required arguments: ${missing.join(", ")}.\n` +
        "Expected: node main.js <prompt-file-path> <init-state-folder> <agent-file-path> <model-name>",
    );
  }

  return {
    promptFilePath: normalizedPromptFilePath,
    environmentFolderPath: normalizedEnvironmentFolderPath,
    agentFilePath: normalizedAgentFilePath,
    modelName: normalizedModelName,
  };
};

const logResolvedArgs = (args: CliArgs): void => {
  console.log("Resolved runner parameters:");
  Object.entries(args).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
};

const loadPromptText = (promptFilePath: string): string => {
  const resolvedPromptPath = resolve(process.cwd(), promptFilePath);
  if (!existsSync(resolvedPromptPath)) {
    throw new Error(`Prompt file not found: ${resolvedPromptPath}`);
  }
  return readFileSync(resolvedPromptPath, "utf8");
};

const runResponseToMarkdown = (): void => {
  writeResponseMarkdownFromJsonl({
    inputPath: "agents.jsonl",
    outputPath: "RESPONSE.md",
  });
};

const writeSummaryFile = (input: {
  taskId: string;
  prompt: string;
  /** Client-generated GUID from cwd folder name; use as unique id when pushing task results to the backend. */
  taskRunId: string;
  /** Last path segment of the init_state folder (contract field name `environmentId`). */
  environmentId: string;
  model: string;
  pipelineId: string;
  usage: ReturnType<typeof buildRunnerUsageSummary>;
}) => {
  const summary = {
    version: "1",
    results: [
      {
        promptDef: {
          name: input.taskId,
          prompt: input.prompt,
        },
        score: null,
      },
    ],
    details: {
      summary: {
        taskId: input.taskId,
        prompt: input.prompt,
        taskRunId: input.taskRunId,
        environmentId: input.environmentId,
        model: input.model,
        runner: {
          id: "deepagents",
        },
        pipelineId: input.pipelineId,
        usage: input.usage,
      },
    },
  };
  writeFileSync(
    "summary.json",
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  console.log("Wrote summary.json");
};

/** LangChain `tool({ name })` ids this runner can instantiate (must match AGENTS.md `tools:` entries). */
const PLAN_AND_FIND_TOOL_IDS = [
  "list_pattern_catalog",
  "search_pattern_context",
  "search_constraint_context",
  "search_cypher_context",
  "code-graph-query",
] as const;

type PlanAndFindToolId = (typeof PLAN_AND_FIND_TOOL_IDS)[number];

function isPlanAndFindToolId(id: string): id is PlanAndFindToolId {
  return (PLAN_AND_FIND_TOOL_IDS as readonly string[]).includes(id);
}

type PlanAndFindTool =
  | ReturnType<typeof createListPatternCatalogTool>
  | ReturnType<typeof createPatternContextSearchTool>
  | ReturnType<typeof createConstraintContextSearchTool>
  | ReturnType<typeof createCypherContextSearchTool>
  | ReturnType<typeof createCodeGraphQueryTool>;

function createPlanAndFindToolById(id: string, cwd: string): PlanAndFindTool {
  if (!isPlanAndFindToolId(id)) {
    throw new Error(
      `Unknown tool "${id}". Known: ${PLAN_AND_FIND_TOOL_IDS.join(", ")}`,
    );
  }
  switch (id) {
    case "list_pattern_catalog":
      return createListPatternCatalogTool({ cwd });
    case "search_pattern_context":
      return createPatternContextSearchTool({ cwd });
    case "search_constraint_context":
      return createConstraintContextSearchTool({ cwd });
    case "search_cypher_context":
      return createCypherContextSearchTool({ cwd });
    case "code-graph-query":
      return createCodeGraphQueryTool({ cwd });
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unhandled tool id: ${_exhaustive}`);
    }
  }
}

const main = async () => {
  const args = parseCliArgs();
  const taskRunId = getTaskRunIdFromCwd();
  const workspaceRoot = process.cwd();
  const initStateAbsolute = resolve(workspaceRoot, args.environmentFolderPath);
  assertDirectoryExists(initStateAbsolute, "Init state folder");

  console.log(`Task run id (from cwd): ${taskRunId}`);
  console.log(`Resetting workspace: ${workspaceRoot}`);
  emptyDirectoryInPlace(workspaceRoot);
  console.log(`Copying init state from: ${initStateAbsolute}`);
  copyInitStateIntoWorkspace(initStateAbsolute, workspaceRoot);

  logResolvedArgs(args);
  const prompt = loadPromptText(args.promptFilePath);
  const taskId = parse(args.promptFilePath).name;
  console.log("Starting agent workflow...");

  const agentDef = provideSubAgent(args.agentFilePath);
  console.log(`Agent "${agentDef.name}"`);

  const model = new ChatOpenRouter({
    model: args.modelName,
    temperature: 0,
  });
  console.log(`Using ${model.constructor.name}, model id: ${model.model}`);
  console.log(`LocalShell backend root (virtual /): ${process.cwd()}`);

  const backend = await LocalShellBackend.create({
    rootDir: process.cwd(),
    virtualMode: true,
    inheritEnv: true,
  });

  const cwd = process.cwd();
  const tools: PlanAndFindTool[] = agentDef.tools.map((id) =>
    createPlanAndFindToolById(id, cwd),
  );

  const agent = createDeepAgent({
    model,
    systemPrompt: agentDef.systemPrompt,
    tools,
    backend,
    middleware: [createToolTraceMiddleware()],
  });

  console.log("Invoking agent with prompt file content");
  const result = await agent.invoke({
    messages: [new HumanMessage(prompt)],
  } as unknown as Parameters<typeof agent.invoke>[0]);

  console.log("--------------------------------");
  console.log(`Total messages: ${result.messages.length}`);
  console.log(
    "Last message:",
    result.messages[result.messages.length - 1].content,
  );
  const openRouterUsage = buildOpenRouterUsageFromAgentResult(
    result as Parameters<typeof buildOpenRouterUsageFromAgentResult>[0],
  );
  logOpenRouterUsage(openRouterUsage);
  console.log("--------------------------------");
  appendFileSync("agents.jsonl", `${JSON.stringify(result)}\n`);

  const usageSummary = buildRunnerUsageSummary(openRouterUsage);

  try {
    runResponseToMarkdown();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  }

  writeSummaryFile({
    taskId,
    prompt,
    taskRunId,
    environmentId: basename(initStateAbsolute),
    model: model.model,
    pipelineId: agentDef.pipelineId,
    usage: usageSummary,
  });
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
