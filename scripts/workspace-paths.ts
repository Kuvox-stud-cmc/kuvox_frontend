import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const workspace = resolve(root, "..");

function resolveRepoPath(repo: string): string | null {
  const candidates = [
    resolve(workspace, repo),
    resolve(root, repo),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function readFrontendFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

export function readWorkspaceFile(repo: string, path: string): string | null {
  const repoPath = resolveRepoPath(repo);
  if (!repoPath) {
    return null;
  }

  const filePath = resolve(repoPath, path);
  if (!existsSync(filePath)) {
    return null;
  }

  return readFileSync(filePath, "utf8");
}

export function workspaceFileExists(repo: string, path: string): boolean {
  const repoPath = resolveRepoPath(repo);
  return repoPath ? existsSync(resolve(repoPath, path)) : false;
}

export function warnSkippedWorkspaceAssertion(label: string, repo: string): void {
  console.warn(`[verify] skipped ${label}: ${repo} repository is not available in this checkout`);
}
