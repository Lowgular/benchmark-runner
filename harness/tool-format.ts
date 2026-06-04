const useColor = process.stdout.isTTY;

export const C = useColor
  ? {
      reset: "\x1b[0m",
      dim: "\x1b[2m",
      bold: "\x1b[1m",
      cyan: "\x1b[36m",
      magenta: "\x1b[35m",
      yellow: "\x1b[33m",
      green: "\x1b[32m",
      red: "\x1b[31m",
      blue: "\x1b[34m",
      gray: "\x1b[90m",
    }
  : {
      reset: "",
      dim: "",
      bold: "",
      cyan: "",
      magenta: "",
      yellow: "",
      green: "",
      red: "",
      blue: "",
      gray: "",
    };

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function fmtToolUse(name: string, input: unknown): string {
  const i = input as Record<string, unknown>;
  const head = `${C.cyan}${C.bold}${name}${C.reset}`;
  switch (name) {
    case "Bash":
      return `${head} ${C.gray}${truncate(String(i["command"] ?? "").replaceAll("\n", " ↵ "), 200)}${C.reset}`;
    case "Read":
      return `${head} ${i["file_path"]}${i["offset"] ? ` ${C.dim}(offset ${i["offset"]})${C.reset}` : ""}${i["limit"] ? ` ${C.dim}(limit ${i["limit"]})${C.reset}` : ""}`;
    case "Write": {
      const lines = String(i["content"] ?? "").split("\n").length;
      return `${head} ${i["file_path"]} ${C.dim}(${lines} lines)${C.reset}`;
    }
    case "Edit":
      return `${head} ${i["file_path"]}`;
    case "Glob":
      return `${head} ${i["pattern"]}${i["path"] ? ` ${C.dim}in ${i["path"]}${C.reset}` : ""}`;
    case "Grep": {
      const ext = i["glob"] ? ` ${C.dim}--glob ${i["glob"]}${C.reset}` : "";
      return `${head} ${C.gray}${i["pattern"]}${C.reset}${ext}${i["path"] ? ` ${C.dim}in ${i["path"]}${C.reset}` : ""}`;
    }
    default: {
      const j = truncate(JSON.stringify(input), 200);
      return `${head} ${C.gray}${j}${C.reset}`;
    }
  }
}

export function fmtToolResult(
  content: unknown,
  isError: boolean,
): { body: string; lineCount: number } {
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .map((c) => {
        const cb = c as Record<string, unknown>;
        return cb["type"] === "text" ? String(cb["text"] ?? "") : `[${cb["type"]}]`;
      })
      .join("\n");
  }
  const lines = text.split("\n");
  const headLines = lines.slice(0, 8);
  const omitted = Math.max(0, lines.length - headLines.length);
  const color = isError ? C.red : C.gray;
  const indented = headLines.map((l) => `  ${color}${l}${C.reset}`).join("\n");
  const tail =
    omitted > 0
      ? `\n  ${C.dim}… ${omitted} more line${omitted === 1 ? "" : "s"}${C.reset}`
      : "";
  return { body: `${indented}${tail}`, lineCount: lines.length };
}
