// Arcana name-linking: the book references arcana we already ship as items (e.g. "the Mindgem
// (page 548)") — those pages live in the Minor/Major Arcana appendices, which we don't import as
// journal entries. Instead we link the arcanum's NAME in the body to the existing `arcana` pack item.
// Conservative by design (the user's call): exact proper-noun match only, arcana pack only.
import { readdirSync, readFileSync } from "fs";
import path from "path";

const SYSTEM = "stonetop";
export const ARCANA_PACK = "arcana";
const arcanaUuid = (id) => `Compendium.${SYSTEM}.${ARCANA_PACK}.Item.${id}`;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Index the arcana pack as `[{name, uuid, descriptive}]`. `descriptive` marks the Minor Arcana
 * "what is it" names ("A gold ring", "A wolf pelt") — article-led or very short — which collide with
 * ordinary prose and so are only matched when followed by a page citation (see linkArcana). The rest
 * are distinctive proper nouns ("Mindgem", "Ring of Daagon"), matched on the name alone. Sorted
 * longest-first so a multi-word name matches before any shorter name contained within it.
 */
export function loadArcanaIndex(dir = "packs/src/arcana") {
	const out = [];
	const walk = (d) => {
		for (const e of readdirSync(d, { withFileTypes: true })) {
			if (e.isDirectory()) { if (!e.name.startsWith("_")) walk(path.join(d, e.name)); }
			else if (e.name.endsWith(".json")) {
				const it = JSON.parse(readFileSync(path.join(d, e.name), "utf8"));
				const name = it.name?.trim();
				if (it.type === "arcanum" && name)
					out.push({ name, uuid: arcanaUuid(it._id), descriptive: /^(a|an|the)\b/i.test(name) || name.length < 5 });
			}
		}
	};
	walk(dir);
	out.sort((a, b) => b.name.length - a.name.length);
	return out;
}

const PROT = "<[^>]+>|@\\w+\\[[^\\]]*\\](?:\\{[^}]*\\})?"; // an HTML tag or an enricher token — pass through

/**
 * Link arcana names in body HTML to their arcana item, skipping HTML tags and existing enricher
 * tokens, one link per arcanum per entry (avoid over-linking). Two precision tiers:
 *  - proper nouns ("Mindgem"): linked on the first bare, case-sensitive, whole-word mention;
 *  - descriptive Minor Arcana names ("A gold ring"): linked only when immediately followed by a
 *    "(page N)" citation — the signal it's a deliberate arcanum reference, not incidental prose.
 * Returns `{html, linked}`.
 */
export function linkArcana(html, index) {
	const proper = index.filter((a) => !a.descriptive);
	const descriptive = index.filter((a) => a.descriptive);
	const used = new Set();
	let linked = 0, out = html;

	if (proper.length) {
		const byName = new Map(proper.map((a) => [a.name, a.uuid]));
		const alt = proper.map((a) => escapeRe(a.name)).join("|");
		const re = new RegExp(`(${PROT})|\\b(${alt})\\b`, "g");
		out = out.replace(re, (m, prot, name) => {
			if (prot) return prot;
			if (used.has(name)) return name;
			used.add(name); linked++;
			return `@UUID[${byName.get(name)}]{${name}}`;
		});
	}
	if (descriptive.length) {
		const byLower = new Map(descriptive.map((a) => [a.name.toLowerCase(), a.uuid]));
		const alt = descriptive.map((a) => escapeRe(a.name)).join("|");
		// Lookahead (no consume): optional closing emphasis tags, then a literal "(page N)". A
		// journal-range ref is already a token by now, so a remaining literal citation is an
		// appendix page — i.e. a real arcanum reference.
		const re = new RegExp(`(${PROT})|(${alt})(?=(?:</\\w+>)*\\s*\\(pages?\\s+\\d+)`, "gi");
		out = out.replace(re, (m, prot, name) => {
			if (prot) return prot;
			const key = name.toLowerCase();
			if (used.has(key)) return name;
			used.add(key); linked++;
			return `@UUID[${byLower.get(key)}]{${name}}`;
		});
	}
	return { html: out, linked };
}
