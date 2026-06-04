import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

interface Row {
  title: string;
  project: string;
  status: TestResult["status"];
  attachments: Array<{ name: string; path: string }>;
  errorMessage: string | undefined;
}

const PIXEL_DIFF_RE = /(\d+) pixels[^]*?\(ratio ([\d.]+) of all image pixels\)/;

export default class VrtSummaryReporter implements Reporter {
  private rows: Row[] = [];
  private outDir = "test-results";

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

    const failed = this.rows.filter((r) => r.status !== "passed");
    const passed = this.rows.filter((r) => r.status === "passed");

    const lines: string[] = [];
    lines.push("# VRT Summary");
    lines.push("");
    lines.push(`Passed: ${passed.length} / ${this.rows.length}`);
    lines.push("");

    if (failed.length) {
      lines.push("## Failures");
      lines.push("");
      for (const r of failed) {
        const diff = r.errorMessage && PIXEL_DIFF_RE.exec(r.errorMessage);
        const headline = diff
          ? `${r.title} (${r.project}) — ${diff[1]} px differ (ratio ${diff[2]})`
          : `${r.title} (${r.project}) — ${r.status}`;
        lines.push(`### ${headline}`);
        lines.push("");

        const actual = r.attachments.find((a) => a.name.endsWith("-actual.png"));
        const expected = r.attachments.find((a) => a.name.endsWith("-expected.png"));
        const dimg = r.attachments.find((a) => a.name.endsWith("-diff.png"));
        if (actual || expected || dimg) {
          lines.push("Artifacts (relative to test-results/):");
          if (expected) lines.push(`- expected: \`${relative(this.outDir, expected.path)}\``);
          if (actual) lines.push(`- actual:   \`${relative(this.outDir, actual.path)}\``);
          if (dimg) lines.push(`- diff:     \`${relative(this.outDir, dimg.path)}\``);
          lines.push("");
        }

        if (r.errorMessage) {
          const trimmed = r.errorMessage.trim().split("\n").slice(0, 10).join("\n");
          lines.push("```");
          lines.push(trimmed);
          lines.push("```");
          lines.push("");
        }
      }
    }

    if (passed.length) {
      lines.push("## Passed");
      lines.push("");
      for (const r of passed) lines.push(`- ${r.title} (${r.project})`);
      lines.push("");
    }

    writeFileSync(join(this.outDir, "SUMMARY.md"), `${lines.join("\n")}\n`, "utf8");
  }
}
