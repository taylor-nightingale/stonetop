import { toRollableMarkup } from "../utils/enrichGameText.js";

// A block-level tag anywhere in the value means the text has already been through a ProseMirror
// editor (its serializer always emits <p>), so it must be handed back untouched — running the
// markdown pass over it again would mangle the markup.
const BLOCK_HTML = /<(p|div|ul|ol|li|h[1-6]|blockquote|table|pre|section|figure)\b/i;

/**
 * Plain text / markdown → the paragraph HTML a ProseMirror editor expects. A migration-only
 * conversion, not a render path: the display pipeline ({{rich}} / RichText) leaves block structure
 * to the surrounding partial, but a value STORED for ProseMirror carries its own, and a blank-line
 * break that reaches the editor un-wrapped is flattened for good.
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
		.map(html => `<p>${html}</p>`)
		.join("");
}
