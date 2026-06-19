// One-time, idempotent converter: rewrites HTML in pack JSON to the markdown we now store
// (rendered back to HTML at display time by enrichGameText). Handles the tags that actually
// occur in the packs: <strong>/<em>, <ul>/<ol>/<li>, <p>, <br>.
//
//   node scripts/html-to-markdown-packs.js
//
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "src");

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

function htmlToMarkdown(s) {
	if (typeof s !== "string") return s;
	let out = s;
	if (out.includes("<")) {
		out = out
			.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${inner.replace(/\s+/g, " ").trim()}`)
			.replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n")
			.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
			.replace(/<\/?p\b[^>]*>/gi, "")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?(strong|b)\b[^>]*>/gi, "**")
			.replace(/<\/?(em|i)\b[^>]*>/gi, "*")
			.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "");          // any leftover real tag
		for (const [ent, ch] of Object.entries(ENTITIES)) out = out.split(ent).join(ch);
		out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
	}
	// snarkdown can't nest **/* — bold+italic must be written **_…_**, not ***…***.
	out = out.replace(/\*\*\*([\s\S]+?)\*\*\*/g, "**_$1_**");
	return out;
}

function convert(value) {
	if (typeof value === "string") return htmlToMarkdown(value);
	if (Array.isArray(value)) return value.map(convert);
	if (value && typeof value === "object") {
		for (const k of Object.keys(value)) value[k] = convert(value[k]);
		return value;
	}
	return value;
}

function walk(dir) {
	return readdirSync(dir).flatMap(name => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return name === "_folders" ? [] : walk(p);
		return p.endsWith(".json") ? [p] : [];
	});
}

let changed = 0;
for (const file of walk(SRC)) {
	const before = readFileSync(file, "utf8");
	const indent = before.match(/\n([ \t]+)"/)?.[1] ?? "\t";   // preserve the file's own indentation
	const trailing = before.endsWith("\n") ? "\n" : "";
	const after = JSON.stringify(convert(JSON.parse(before)), null, indent) + trailing;
	if (after !== before) { writeFileSync(file, after); changed++; }
}
console.log(`Done — ${changed} file(s) changed.`);
