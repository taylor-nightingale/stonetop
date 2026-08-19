import { rich, hasText } from "../model/snapshot/RichText.js";
import { isGroupTag } from "../model/data/groupTag.js";

/**
 * Every Handlebars helper the Stonetop templates use, in one place.
 *
 * Takes the Handlebars instance rather than reaching for a global, so the system registers them on
 * Foundry's and the tests register them on their own — one description of what `{{rich x}}` or
 * `{{resourceChecks r}}` means, rather than the templates meaning one thing in play and another in
 * a test fixture.
 */
export function registerStonetopHelpers(Handlebars) {
Handlebars.registerHelper("resourceChecks", resource => {
	if (!resource) return [];
	const { current, max, labels } = resource;
	return Array.from({ length: max ?? 0 }, (_, i) => ({ checked: i < (current ?? 0), label: labels?.[i] || null }));
});

Handlebars.registerHelper("poolGroups", pool => {
	if (!pool) return [];
	const { current } = pool;
	return [
		Array.from({ length: 3 }, (_, i) => ({ checked: i < current, index: i })),
		Array.from({ length: 3 }, (_, i) => ({ checked: (i + 3) < current, index: i + 3 })),
		Array.from({ length: 3 }, (_, i) => ({ checked: (i + 6) < current, index: i + 6 })),
	];
});

Handlebars.registerHelper("times", n => Array.from({ length: n ?? 0 }, (_, i) => i));

Handlebars.registerHelper("outfitSegments", items => {
	const segments = [];
	let current = null;
	for (const item of (items ?? [])) {
		if (!current || current.isGrid !== item.twoCol) {
			current = { isGrid: item.twoCol, items: [] };
			segments.push(current);
		}
		current.items.push(item);
	}
	return segments;
});
Handlebars.registerHelper("gt", (a, b) => a > b);
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("join", (arr, sep) => (Array.isArray(arr) ? arr.join(typeof sep === "string" ? sep : ", ") : ""));
Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));

// The single render path for game text. Accepts a RichText (enriched by enrichRichTextTree in
// getData) or a bare string (rendered as markdown). One way to render text: {{rich field}}.
Handlebars.registerHelper("rich", value => new Handlebars.SafeString(rich(value).render()));

// Truthiness for an optional text field that may arrive as a bare string OR a RichText — used to
// guard optional notes/subtitles in the shared heading partials: {{#if (hasText note)}}.
Handlebars.registerHelper("hasText", hasText);

// A tag chip that marks a creature as a group ("group" / "horde") carries the group tooltip
// instead of the plain "remove" one: {{#if (isGroupTag this)}}.
Handlebars.registerHelper("isGroupTag", isGroupTag);

Handlebars.registerHelper("repeatChecks", move => {
	const sel = move?.selection;
	if (!sel || sel.max <= 1) return [];
	return Array.from({ length: sel.max }, (_, i) => ({
		checked:  i < sel.value,
		disabled: i < sel.value ? move.isStarting : (!move.selectable || i !== sel.value),
	}));
});
}
