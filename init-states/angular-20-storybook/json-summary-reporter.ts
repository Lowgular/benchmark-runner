import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Row {
  title: string;
  project: string;
  status: TestResult["status"];
  attachments: Array<{ name: string; path: string }>;
  errorMessage: string | undefined;
}

/**
 * JsonSummaryReporter — writes a D-13 JSON envelope to test-results/<script-kebab>.json.
 *
 * The script name is read from process.env.VERIFY_SCRIPT (e.g. "verify:stories",
 * "validate:a11y"). ":" is replaced with "-" to form the filename
 * (verify:stories → test-results/verify-stories.json).
 *
 * When VERIFY_SCRIPT is unset, falls back to "verify" → test-results/verify.json.
 *
 * Envelope shape (D-13):
 * {
 *   script: string,
 *   status: "pass" | "fail",
 *   summary: { total, passed, failed },
 *   details: [{ title, status, errorMessage, attachments }]
 * }
 */
export default class JsonSummaryReporter implements Reporter {
  private rows: Row[] = [];
  private outDir = "test-results";
  private scriptName: string = process.env["VERIFY_SCRIPT"] ?? "verify";

  onBegin(config: FullConfig): void {
    const projectOutDir = config.projects[0]?.outputDir;
    this.outDir = resolve(projectOutDir ?? "test-results");
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.rows.push({
      title: test.titlePath().slice(1).join(" > "),
      project: test.parent.project()?.name ?? "",
      status: result.status,
      attachments: result.attachments
        .filter((a) => a.path && a.name)
        .map((a) => ({ name: a.name, path: a.path! })),
      errorMessage: result.errors[0]?.message,
    });
  }

  onEnd(): void {
    mkdirSync(this.outDir, { recursive: true });

    const passed = this.rows.filter((r) => r.status === "passed");
    const failed = this.rows.filter((r) => r.status !== "passed");

    const envelope = {
      script: this.scriptName,
      status: failed.length === 0 ? "pass" : "fail",
      summary: {
        total: this.rows.length,
        passed: passed.length,
        failed: failed.length,
      },
      details: this.rows.map((r) => ({
        title: r.title,
        status: r.status,
        errorMessage: r.errorMessage ?? null,
        attachments: r.attachments,
      })),
    };

    // kebab: "verify:stories" → "verify-stories"
    const filename = `${this.scriptName.replace(/:/g, "-")}.json`;

    writeFileSync(
      join(this.outDir, filename),
      JSON.stringify(envelope, null, 2),
      "utf8",
    );
  }
}
