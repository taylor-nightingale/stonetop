import { rich, hasText } from "../model/snapshot/RichText.js";
import { isGroupTag } from "../model/data/groupTag.js";
import { TagLabels } from "../model/data/TagLabels.js";
import { Advice, adviceLabel } from "../model/data/Advice.js";

/**
 * Every Handlebars helper the Stonetop templates use, in one place.
 *
 * Takes the Handlebars instance rather than reaching for a global, so the system registers them on
 * Foundry's and the tests register them on their own — one description of what `{{rich x}}` or
 * `{{resourceChecks r}}` means, rather than the templates meaning one thing in play and another in
 * a test fixture.
 */
export function registerStonetopHelpers(Handlebars) {
// `position`/`total` are what let a pip describe itself: a track renders as a row of identical
// buttons, so without them a screen reader announces the same nameless control N times over and
// gives no way to tell which one is which, or how full the track is.
Handlebars.registerHelper("resourceChecks", resource => {
	if (!resource) return [];
	const { current, max, labels } = resource;
	const total = max ?? 0;
	return Array.from({ length: total }, (_, i) => ({
		checked: i < (current ?? 0),
		label: labels?.[i] || null,
		position: i + 1,
		total
	}));
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

// `{{inc @index}}` — Handlebars indexes from 0 and people count from 1. Used where a control has to
// say which of N it is out loud, e.g. "Track 2 of 5".
Handlebars.registerHelper("inc", n => Number(n ?? 0) + 1);

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

// What a tag chip READS. The token itself stays English wherever it is stored — `hasGroupTag`
// matches on it and the glossary is keyed by it — so only the rendered text is localized:
// {{rich (tagLabel this)}}, never {{tagLabel}} on its own into a data attribute.
Handlebars.registerHelper("tagLabel", token => TagLabels.current.labelFor(token));

// What a ? button calls itself, from the topic key alone: {{adviceLabel "prosperity"}}. Derived
// rather than passed in, so the ten book headings live in the language file once (as the advice's
// own titles) instead of again as button labels. Reaches for game.i18n exactly as core's own
// `localize` helper does. Empty for a topic the book has no advice for — the partial renders no
// button at all rather than a nameless one.
Handlebars.registerHelper("adviceLabel", key =>
	adviceLabel(Advice.current.lookup(key), (k, data) => game.i18n.format(k, data)));

Handlebars.registerHelper("repeatChecks", move => {
	const sel = move?.selection;
	if (!sel || sel.max <= 1) return [];
	return Array.from({ length: sel.max }, (_, i) => ({
		checked:  i < sel.value,
		disabled: i < sel.value ? move.isStarting : (!move.selectable || i !== sel.value),
	}));
});
}
