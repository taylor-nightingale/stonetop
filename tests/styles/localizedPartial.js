import Handlebars from "handlebars";
import { readFileSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";

/**
 * Render a real partial for a layout probe, with a real language file's strings in it.
 *
 * The template harness's `localize` returns the KEY, which is right for template tests — they assert
 * on which key was asked for, not on copy — and useless for a layout one: a 40-character key in a
 * 96px tile proves nothing about "Rüstung" in it.
 *
 * German by default, deliberately. It is the hardest case the shipped translations have — "Rüstung"
 * (62px) and "Schaden" (64px) overflowed tiles that "Armor" and "Damage" sat inside — and a tile's
 * label is absolutely positioned across its rule, so it never sizes its own grid track and nothing
 * in the cascade says it does not fit.
 */
const cache = new Map();

function strings(lang) {
	if (!cache.has(lang)) {
		cache.set(lang, JSON.parse(readFileSync(path.resolve(process.cwd(), `languages/${lang}.json`), "utf8")));
	}
	return cache.get(lang);
}

const lookup = (table, key) => key.split(".").reduce((node, part) => node?.[part], table);

/**
 * @param {string} name    a registered partial, e.g. "stonetop.actor-attributes"
 * @param {object} context the render context
 * @param {string} [lang]  which languages/<lang>.json to resolve keys against
 * @returns {string} HTML with real words in it
 */
export function renderLocalized(name, context = {}, lang = "de") {
	const table = strings(lang);
	// Overwrites the harness's key-returning helper on the shared instance. Vitest isolates modules
	// per test file, so this reaches only the file that asked for it.
	Handlebars.registerHelper("localize", (key, options) => {
		const data = options?.hash ?? {};
		const value = lookup(table, key);
		if (typeof value !== "string") return key;
		return Object.entries(data).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), value);
	});
	return renderPartial(name, context);
}
