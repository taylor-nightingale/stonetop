import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const STYLES_DIR = path.resolve("styles");
const SCAN_DIRS = ["src", "templates"].map(d => path.resolve(d));

// Foundry installs can be served under a route prefix (e.g. https://host/foundry/). Paths stored
// in documents are resolved by Foundry, which prepends the prefix; paths we write ourselves are
// not. A leading slash makes the browser resolve against the domain root, skipping the prefix and
// 404ing. CSS must use stylesheet-relative paths (../assets/…) and JS must use foundry.utils.getRoute().
const ABSOLUTE_SYSTEM_PATH = /["'`]\/systems\//;

async function findFiles(dir, ext) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const results = await Promise.all(entries.map(async entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return findFiles(full, ext);
		if (ext.includes(path.extname(entry.name))) return [full];
		return [];
	}));
	return results.flat();
}

function extractUrls(css) {
	// Comments explain where a value came from and often quote core's own paths; those are prose,
	// not assets we ship.
	css = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const RE = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
	const urls = [];
	let m;
	while ((m = RE.exec(css)) !== null) urls.push(m[2].trim());
	return urls;
}

// Only paths we ship need to resolve on disk; inline and remote assets are out of scope.
const isLocalPath = (url) => !/^(data:|https?:|\/\/)/.test(url);

let stylesheets;
let sourceFiles;

beforeAll(async () => {
	const cssFiles = await findFiles(STYLES_DIR, [".css"]);
	stylesheets = await Promise.all(cssFiles.map(async f => ({
		file: path.relative(STYLES_DIR, f),
		dir:  path.dirname(f),
		css:  await fs.readFile(f, "utf8"),
	})));

	const scanned = (await Promise.all(
		SCAN_DIRS.map(dir => findFiles(dir, [".js", ".hbs", ".html"]))
	)).flat();
	sourceFiles = await Promise.all(scanned.map(async f => ({
		file: path.relative(process.cwd(), f),
		text: await fs.readFile(f, "utf8"),
	})));
});

describe("asset paths survive a route prefix", () => {
	it("found stylesheets and source files to check", () => {
		expect(stylesheets.length).toBeGreaterThan(0);
		expect(sourceFiles.length).toBeGreaterThan(0);
	});

	it("no stylesheet uses a root-absolute /systems/ url", () => {
		const bad = [];
		for (const { file, css } of stylesheets) {
			for (const url of extractUrls(css)) {
				if (url.startsWith("/systems/")) bad.push(`${file}: url(${url})`);
			}
		}
		expect(bad).toEqual([]);
	});

	it("every local stylesheet url resolves to a file on disk", async () => {
		const missing = [];
		for (const { file, dir, css } of stylesheets) {
			for (const url of new Set(extractUrls(css).filter(isLocalPath))) {
				const target = path.resolve(dir, url.split(/[?#]/)[0]);
				const exists = await fs.access(target).then(() => true, () => false);
				if (!exists) missing.push(`${file}: url(${url})`);
			}
		}
		expect(missing).toEqual([]);
	});

	it("no source file hardcodes a root-absolute /systems/ path", () => {
		const bad = sourceFiles
			.filter(({ text }) => ABSOLUTE_SYSTEM_PATH.test(text))
			.map(({ file }) => file);
		expect(bad).toEqual([]);
	});
});
