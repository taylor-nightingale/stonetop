import { toRollableMarkup } from "../utils/enrichGameText.js";

// A block-level tag anywhere in the value means the text has already been through a ProseMirror
// editor (its serializer always emits <p>), so it must be handed back untouched — running the
// markdown pass over it again would mangle the markup.
const BLOCK_HTML = /<(p|div|ul|ol|li|h[1-6]|blockquote|table|pre|section|figure)\b/i;

// A block the markdown pass has already given its own block-level wrapper — a list, a heading, a
// quote. Wrapping one in <p> produces `<p><ul>…</ul></p>`, which no parser accepts: the browser
// closes the paragraph before the list and leaves an empty <p> behind it, and ProseMirror drops the
// structure on its next save. A move's options ("A week or so: 1 Preparation") are exactly this
// shape, so it is the common case rather than an edge one.
const STARTS_BLOCK = /^<(ul|ol|h[1-6]|blockquote|pre|table)\b/i;

/**
 * Plain text / markdown → the paragraph HTML a ProseMirror editor expects.
 *
 * A migration-and-seed conversion, not a render path: the display pipeline ({{rich}} / RichText)
 * leaves block structure to the surrounding partial, but a value HANDED TO a ProseMirror carries its
 * own, and markdown that reaches the editor un-converted is parsed as one text run — HTML has no
 * significant newlines — and flattened for good on the editor's next save.
 *
 * Idempotent: already-HTML values (anything a ProseMirror editor has saved) are returned as-is.
 */
export function richTextToHtml(value) {
	const text = (value ?? "").trim();
	if (!text) return "";
	if (BLOCK_HTML.test(text)) return text;
	return text
		.split(/\n\s*\n/)
		.map(block => toRollableMarkup(block.trim(), { autoRoll: false }).replace(/\n/g, "<br>"))
		.filter(html => html.length > 0)
		.map(html => (STARTS_BLOCK.test(html) ? html : `<p>${html}</p>`))
		.join("");
}
