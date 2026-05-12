import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const SRC_DIR = path.resolve("packs/src");

async function findJsonFiles(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const results = await Promise.all(entries.map(async entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return findJsonFiles(full);
		if (entry.name.endsWith(".json")) return [full];
		return [];
	}));
	return results.flat();
}

// Stack-based balanced HTML tag checker. Returns a list of problem descriptions.
function checkHtmlBalance(html) {
	const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img",
	                      "input", "link", "meta", "source", "track", "wbr"]);
	const RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
	const stack = [];
	const issues = [];
	let m;
	while ((m = RE.exec(html)) !== null) {
		const tag = m[1].toLowerCase();
		if (VOID.has(tag)) continue;
		if (m[0].startsWith("</")) {
			if (stack.length === 0 || stack[stack.length - 1] !== tag) {
				issues.push(`unexpected </${tag}> (open: ${stack[stack.length - 1] ?? "none"})`);
			} else {
				stack.pop();
			}
		} else if (!m[0].endsWith("/>")) {
			stack.push(tag);
		}
	}
	for (const tag of stack) issues.push(`unclosed <${tag}>`);
	return issues;
}

let allDocs;

beforeAll(async () => {
	const files = await findJsonFiles(SRC_DIR);
	allDocs = await Promise.all(files.map(async f => ({
		file: path.relative(SRC_DIR, f),
		doc:  JSON.parse(await fs.readFile(f, "utf8")),
	})));
});

describe("pack source files", () => {
	it("found at least one source file", () => {
		expect(allDocs.length).toBeGreaterThan(0);
	});

	it("all have a valid _id (16 alphanumeric characters)", () => {
		const bad = allDocs.filter(({ doc }) => !/^[A-Za-z0-9]{16}$/.test(doc._id));
		expect(bad.map(b => b.file)).toEqual([]);
	});

	it("all have _key matching !items!{_id} or !folders!{_id}", () => {
		const bad = allDocs.filter(({ doc }) =>
			doc._key !== `!items!${doc._id}` && doc._key !== `!folders!${doc._id}`
		);
		expect(bad.map(b => b.file)).toEqual([]);
	});

	it("all have name and type fields", () => {
		const bad = allDocs.filter(({ doc }) => !doc.name || !doc.type);
		expect(bad.map(b => b.file)).toEqual([]);
	});

	it("HTML descriptions have balanced tags", () => {
		const issues = [];
		for (const { file, doc } of allDocs) {
			const desc = doc.system?.description;
			if (!desc) continue;
			const problems = checkHtmlBalance(desc);
			if (problems.length) issues.push(`${file}: ${problems.join("; ")}`);
		}
		expect(issues).toEqual([]);
	});
});
