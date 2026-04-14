import {
  cpSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from "fs";
import { basename, resolve } from "path";

/** CWD folder name must be a UUID (client-generated run id for the backend). */
const TASK_RUN_GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getTaskRunIdFromCwd(): string {
  const cwd = process.cwd();
  const name = basename(cwd);
  if (!TASK_RUN_GUID_RE.test(name)) {
    throw new Error(
      `Current working directory must be a folder named with a GUID (task run id). ` +
        `Got "${name}" (cwd: ${cwd})`,
    );
  }
  return name.toLowerCase();
}

export function assertDirectoryExists(absolutePath: string, label: string): void {
  if (!existsSync(absolutePath)) {
    throw new Error(`${label} does not exist: ${absolutePath}`);
  }
  const st = statSync(absolutePath);
  if (!st.isDirectory()) {
    throw new Error(`${label} is not a directory: ${absolutePath}`);
  }
}

/** Removes all entries in `dir` (including hidden files); does not remove `dir` itself. */
export function emptyDirectoryInPlace(dir: string): void {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, ent.name);
    rmSync(p, { recursive: true, force: true });
  }
}

/** Copies init state into workspace `dest` (typically cwd), including dotfiles. */
export function copyInitStateIntoWorkspace(
  initStateDirAbsolute: string,
  destAbsolute: string,
): void {
  cpSync(initStateDirAbsolute, destAbsolute, { recursive: true });
}
