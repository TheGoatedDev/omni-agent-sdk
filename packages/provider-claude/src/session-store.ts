import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SessionInfo } from "@omni-agent-sdk/core";

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Converts an absolute path to the slug Claude Code uses under ~/.claude/projects/. */
function projectSlug(cwd: string): string {
	return cwd.replace(/\//g, "-");
}

/**
 * Reads session directories from ~/.claude/projects/<slug>/ and returns
 * a SessionInfo for each UUID-named directory found.
 *
 * Returns an empty array if the project directory does not exist or cannot
 * be read (e.g. cwd was never used with Claude Code).
 */
export async function readDiskSessions(cwd: string): Promise<SessionInfo[]> {
	const projectDir = join(homedir(), ".claude", "projects", projectSlug(cwd));

	let entries: string[];
	try {
		entries = await readdir(projectDir);
	} catch {
		return [];
	}

	const sessions: SessionInfo[] = [];

	for (const entry of entries) {
		if (!UUID_RE.test(entry)) continue;

		try {
			const info = await stat(join(projectDir, entry));
			// birthtime is the directory creation time on macOS/Linux; fall back to mtime
			sessions.push({ id: entry, createdAt: info.birthtimeMs > 0 ? info.birthtime : info.mtime });
		} catch {
			sessions.push({ id: entry });
		}
	}

	return sessions;
}
