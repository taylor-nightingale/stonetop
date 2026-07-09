import { readFileSync } from "fs";
import path from "path";

// A fake of Foundry's game.i18n for tests. localize() returns the key unchanged (existing tests rely
// on that). format() resolves the key's template against the real languages/en.json and does
// {placeholder} substitution, so it produces the actual UI string (e.g. "Starts at +0") — a test then
// catches a missing/renamed key. Falls back to the key if the string is absent.
// Read via cwd (vitest runs from the project root) so it works in both the node and happy-dom test
// environments — import.meta.url isn't a file:// URL under happy-dom.
const strings = JSON.parse(readFileSync(path.resolve(process.cwd(), "languages/en.json"), "utf8"));

function resolve(key) {
	return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), strings);
}

export function fakeI18n() {
	const localize = (key) => key;
	const format = (key, data = {}) => {
		const template = resolve(key);
		const str = typeof template === "string" ? template : key;
		return str.replace(/\{(\w+)\}/g, (_, name) => (data[name] ?? ""));
	};
	const has = (key) => typeof resolve(key) === "string";
	return { localize, format, has };
}
