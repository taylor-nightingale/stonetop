// Resolve the source books for the PDF import scripts. Extraction needs both
// Book II (wonders/arcana) and, optionally, Book I (steading) — and the two
// files are named similarly, so it's easy to pass them in the wrong order.
// classifyBook() identifies each by its filename so callers can pass them in
// any order; resolveBooks() folds in env overrides and defaults.
import path from "path";
import { execFileSync } from "child_process";

// Defaults are relative to the repo root (npm runs scripts from package.json's dir).
export const DEFAULT_BOOK_II = "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
export const DEFAULT_BOOK_I = "helper/Book_I_-_Stonetop.pdf";

const label = (n) => (n === 2 ? "II" : "I");

/**
 * Classify a PDF path as Book II (2), Book I (1), or unknown (null) from its
 * basename alone — so the two books can be supplied in any order.
 *
 * The trailing `(?=$|[\s._-])` requires the numeral to end at a separator or
 * end-of-name — so "book_ii" reads as II, not I (`\b` can't be used here: `_`
 * counts as a word char, so it wouldn't fire between "ii" and a trailing "_").
 */
export function classifyBook(pdfPath) {
	const b = path.basename(String(pdfPath)).toLowerCase();
	if (/book[\s._-]*(ii|2|two)(?=$|[\s._-])/.test(b) || /wider|wonder/.test(b)) return 2;
	if (/book[\s._-]*(i|1|one)(?=$|[\s._-])/.test(b) || /stonetop/.test(b)) return 1;
	return null;
}

/**
 * Resolve the two source books from positional paths (any order) plus env
 * overrides. Precedence: an explicit CLI path > env var > built-in default.
 * Returns { bookII, bookI } (paths only — existence is the caller's call).
 *
 * Throws on a path that can't be classified, or when two CLI paths both look
 * like the same book — better a clear error than a silent mis-assignment.
 */
export function resolveBooks(paths = [], env = {}) {
	const cli = {};
	for (const p of paths) {
		const n = classifyBook(p);
		if (n === null) {
			throw new Error(
				`Could not tell which book this is: "${p}"\n` +
					`  Rename it to include "Book I" / "Book II", or set BOOK_II_PDF / BOOK_I_PDF.`,
			);
		}
		if (cli[n]) {
			throw new Error(`Two arguments both look like Book ${label(n)}: "${cli[n]}" and "${p}"`);
		}
		cli[n] = p;
	}
	return {
		bookII: cli[2] ?? env.BOOK_II_PDF ?? env.BOOK_PDF ?? DEFAULT_BOOK_II,
		bookI: cli[1] ?? env.BOOK_I_PDF ?? DEFAULT_BOOK_I,
	};
}

// Install hints keyed by binary, so a missing tool errors with a fix instead of ENOENT.
const TOOL_HINTS = {
	mutool: "MuPDF — Linux: apt install mupdf-tools · macOS: brew install mupdf · Windows: scoop install mupdf",
	pdfimages: "Poppler — Linux: apt install poppler-utils · macOS: brew install poppler · Windows: scoop install poppler",
	pdftoppm: "Poppler — Linux: apt install poppler-utils · macOS: brew install poppler · Windows: scoop install poppler",
};

/**
 * Preflight: ensure each external CLI is on PATH, failing fast with an install
 * hint rather than a cryptic ENOENT mid-pipeline. Cross-platform — probes via
 * execFileSync (no shell); a non-zero exit means the tool exists, only ENOENT
 * counts as missing.
 */
export function requireTools(tools = ["mutool", "pdfimages", "pdftoppm"]) {
	const missing = [];
	for (const t of tools) {
		try {
			execFileSync(t, ["-v"], { stdio: "ignore" });
		} catch (e) {
			if (e.code === "ENOENT") missing.push(t);
		}
	}
	if (missing.length) {
		const lines = missing.map((t) => `  • ${t} — ${TOOL_HINTS[t] ?? "not found on PATH"}`);
		throw new Error(`Missing required tool(s) on PATH:\n${lines.join("\n")}`);
	}
}
