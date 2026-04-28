import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { perBuildRatings } from "./ratings/per-build/index.js";
import { AssessmentResult, EvalConfig, EvalOutput, NodeMatch } from "./types";

const usage = () => {
  console.log(
    [
      "Usage: node dist/main.js <expected-config-path>",
      "",
      "Arguments:",
      "  expected-config-path   JSON config file with expected nodes",
    ].join("\n"),
  );
};

const normalizePath = (value: string): string => {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^(\.\/|\/)+/, "");
};

const stripInlineMarkdown = (value: string): string => {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
};

const extractFilePathFromBulletRhs = (raw: string): string => {
  const text = raw.trim();

  // Prefer explicit code-span paths: `web/src/app/app.component.ts`
  const codeSpan = text.match(/`([^`]+)`/);
  if (codeSpan?.[1]) {
    return codeSpan[1].trim();
  }

  // Remove explanatory suffixes, e.g. "(standalone by default ...)".
  const beforeParen = text.split(/\s+\(/, 1)[0]?.trim() ?? "";
  if (beforeParen.length > 0) {
    return beforeParen;
  }

  return text;
};

const normalizeNode = (node: NodeMatch): NodeMatch => {
  return {
    name: stripInlineMarkdown(node.name),
    filePath: normalizePath(stripInlineMarkdown(node.filePath)),
  };
};

const toNodeKey = (node: NodeMatch): string => {
  const normalized = normalizeNode(node);
  return `${normalized.name}::${normalized.filePath}`;
};

const readEvalConfig = (configPath: string): EvalConfig => {
  if (!existsSync(configPath)) {
    throw new Error(`Expected config file not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<EvalConfig>;
  if (!Array.isArray(parsed.expectedNodes)) {
    throw new Error(
      `Invalid config "${configPath}": expected "expectedNodes" array`,
    );
  }

  const expectedNodes = parsed.expectedNodes.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Invalid expectedNodes[${index}]: expected object`);
    }
    const { name, filePath } = entry as Partial<NodeMatch>;
    if (typeof name !== "string" || typeof filePath !== "string") {
      throw new Error(
        `Invalid expectedNodes[${index}]: expected string "name" and "filePath"`,
      );
    }
    return normalizeNode({ name, filePath });
  });

  return { expectedNodes };
};

const parseActualNodesFromResponse = (markdown: string): NodeMatch[] => {
  const finalAnswerHeader = "## Final Answer";
  const sectionStart = markdown.lastIndexOf(finalAnswerHeader);
  if (sectionStart === -1) {
    throw new Error(`Could not find "${finalAnswerHeader}" in RESPONSE.md`);
  }

  const sectionText = markdown.slice(sectionStart + finalAnswerHeader.length);
  const lines = sectionText.split(/\r?\n/).map((line) => line.trim());
  const nodes: NodeMatch[] = [];

  for (const line of lines) {
    const normalizedLine = line.startsWith("- ") ? line : `- ${line}`;
    if (/^- (Stages|Tools used):/i.test(normalizedLine)) continue;

    const match = normalizedLine.match(/^- (.+?)\s+[—-]\s+(.+)$/);
    if (!match) continue;

    const [, name, filePathRaw] = match;
    const filePath = extractFilePathFromBulletRhs(filePathRaw);
    nodes.push(normalizeNode({ name, filePath }));
  }

  return nodes;
};

const dedupeNodes = (nodes: NodeMatch[]): NodeMatch[] => {
  const seen = new Set<string>();
  const deduped: NodeMatch[] = [];
  for (const node of nodes) {
    const key = toNodeKey(node);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(node);
  }
  return deduped;
};

const clampCoefficient = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const buildAssessments = (input: {
  expected: NodeMatch[];
  actual: NodeMatch[];
}): AssessmentResult[] => {
  return perBuildRatings.map((rating) => {
    const rated = rating.rate(input);
    return {
      id: rating.id,
      name: rating.name,
      state: rated.state,
      message: rated.message,
      category: rating.category,
      description: rating.description,
      groupingLabels: rating.groupingLabels,
      scoreReduction: rating.scoreReduction,
      successPercentage: clampCoefficient(rated.coefficient),
    };
  });
};

const evaluate = (
  expectedNodes: NodeMatch[],
  actualNodes: NodeMatch[],
): EvalOutput => {
  const expected = dedupeNodes(expectedNodes);
  const actual = dedupeNodes(actualNodes);

  const expectedByKey = new Map(
    expected.map((node) => [toNodeKey(node), node]),
  );
  const actualByKey = new Map(actual.map((node) => [toNodeKey(node), node]));

  const truePositives = actual.filter((node) =>
    expectedByKey.has(toNodeKey(node)),
  );
  const falsePositives = actual.filter(
    (node) => !expectedByKey.has(toNodeKey(node)),
  );
  const falseNegatives = expected.filter(
    (node) => !actualByKey.has(toNodeKey(node)),
  );

  const precision =
    actual.length === 0 ? 0 : truePositives.length / actual.length;
  const recall =
    expected.length === 0 ? 0 : truePositives.length / expected.length;
  const assessments = buildAssessments({ expected, actual });

  return {
    totals: {
      expected: expected.length,
      actual: actual.length,
      truePositives: truePositives.length,
      falsePositives: falsePositives.length,
      falseNegatives: falseNegatives.length,
    },
    metrics: {
      precision,
      recall,
    },
    expectedNodes: expected,
    actualNodes: actual,
    truePositives,
    falsePositives,
    falseNegatives,
    assessments,
  };
};

const formatNodeList = (nodes: NodeMatch[]): string => {
  if (nodes.length === 0) return "(none)";
  return nodes.map((node) => `- ${node.name} :: ${node.filePath}`).join("\n");
};

const categoryNameFromId = (categoryId: string): string => {
  return categoryId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const enrichSummaryWithAssessments = (
  summaryPath: string,
  assessments: AssessmentResult[],
): void => {
  if (!existsSync(summaryPath)) {
    throw new Error(`summary.json file not found: ${summaryPath}`);
  }
  const rawSummary = readFileSync(summaryPath, "utf8");
  const summary = JSON.parse(rawSummary) as {
    results?: Array<Record<string, unknown>>;
    details?: { summary?: Record<string, unknown> };
  };

  if (!summary.details || typeof summary.details !== "object") {
    summary.details = {};
  }
  if (!summary.details.summary || typeof summary.details.summary !== "object") {
    summary.details.summary = {};
  }

  const detailsSummary = summary.details.summary as Record<string, unknown>;
  if ("assessments" in detailsSummary) {
    delete detailsSummary.assessments;
    console.log("Removed legacy details.summary.assessments field");
  }

  const existingResults = Array.isArray(summary.results) ? summary.results : [];
  let resultEntry: Record<string, unknown>;
  if (existingResults.length === 0) {
    resultEntry = {
      promptDef: {
        name:
          typeof detailsSummary.taskId === "string"
            ? detailsSummary.taskId
            : "unknown-task",
        prompt:
          typeof detailsSummary.prompt === "string" ? detailsSummary.prompt : "",
      },
      score: {
        categories: [],
      },
    };
    summary.results = [resultEntry];
    console.log("summary.results missing -> created results[0] scaffold");
  } else {
    resultEntry = existingResults[0];
    if (existingResults.length > 1) {
      console.log(
        `summary.results has ${existingResults.length} entries -> using results[0]`,
      );
    } else {
      console.log("summary.results found -> using existing results[0]");
    }
  }

  const score =
    resultEntry.score && typeof resultEntry.score === "object"
      ? (resultEntry.score as Record<string, unknown>)
      : {};
  resultEntry.score = score;

  const existingCategories = Array.isArray(score.categories)
    ? (score.categories as Array<Record<string, unknown>>)
    : [];

  const assessmentsByCategory = new Map<string, AssessmentResult[]>();
  for (const assessment of assessments) {
    const list = assessmentsByCategory.get(assessment.category) ?? [];
    list.push(assessment);
    assessmentsByCategory.set(assessment.category, list);
  }

  for (const [categoryId, categoryAssessments] of assessmentsByCategory.entries()) {
    let categoryEntry = existingCategories.find(
      (entry) => entry && typeof entry === "object" && entry.id === categoryId,
    );
    if (!categoryEntry) {
      categoryEntry = {
        id: categoryId,
        name: categoryNameFromId(categoryId),
        maxPoints: 100,
        points: 0,
        assessments: [],
      };
      existingCategories.push(categoryEntry);
      console.log(
        `score.categories missing "${categoryId}" -> created category entry`,
      );
    } else if (
      typeof categoryEntry.name !== "string" ||
      categoryEntry.name.trim().length === 0
    ) {
      categoryEntry.name = categoryNameFromId(categoryId);
    }

    categoryEntry.assessments = categoryAssessments;
  }

  score.categories = existingCategories;

  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
};

const main = () => {
  const [, , rawConfigPath] = process.argv;
  const configPath = rawConfigPath?.trim() ?? "";
  const responsePath = resolve(process.cwd(), "RESPONSE.md");
  const summaryPath = resolve(process.cwd(), "summary.json");

  if (!configPath) {
    usage();
    throw new Error(
      "Missing required arguments. Expected: <expected-config-path>",
    );
  }

  const resolvedConfigPath = resolve(process.cwd(), configPath);

  if (!existsSync(responsePath)) {
    throw new Error(
      `Required RESPONSE.md file not found in cwd: ${process.cwd()}`,
    );
  }
  if (!existsSync(summaryPath)) {
    throw new Error(
      `Required summary.json file not found in cwd: ${process.cwd()}`,
    );
  }

  const config = readEvalConfig(resolvedConfigPath);
  const responseMarkdown = readFileSync(responsePath, "utf8");
  const actualNodes = parseActualNodesFromResponse(responseMarkdown);
  const result = evaluate(
    config.expectedNodes,
    actualNodes,
  );

  console.log("Eval input:");
  console.log(`- expected nodes: ${result.expectedNodes.length}`);
  console.log(`- actual nodes:   ${result.actualNodes.length}`);
  console.log("Expected nodes:");
  console.log(formatNodeList(result.expectedNodes));
  console.log("Actual nodes:");
  console.log(formatNodeList(result.actualNodes));
  console.log("Comparison:");
  console.log(`- true positives:  ${result.truePositives.length}`);
  console.log(`- false positives: ${result.falsePositives.length}`);
  console.log(`- false negatives: ${result.falseNegatives.length}`);
  if (result.falsePositives.length > 0) {
    console.log("False positives:");
    console.log(formatNodeList(result.falsePositives));
  }
  if (result.falseNegatives.length > 0) {
    console.log("False negatives:");
    console.log(formatNodeList(result.falseNegatives));
  }

  enrichSummaryWithAssessments(summaryPath, result.assessments);
  console.log(`Enriched ${summaryPath} with assessments`);
  console.log(
    `Precision: ${result.metrics.precision.toFixed(4)}, Recall: ${result.metrics.recall.toFixed(4)}`,
  );
};

main();
