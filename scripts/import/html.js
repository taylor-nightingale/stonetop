/** Small HTML helpers for flattening the fork's structured pages into journal HTML. */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape plain text for safe inclusion as HTML content. */
export function escapeHtml(text) {
	return String(text ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Trim and drop runs of empty lines / inter-tag whitespace, leaving null/empty as "". */
export function normalizeHtml(value) {
	if (value == null) return "";
	return String(value).replace(/>\s+</g, "><").replace(/\n{3,}/g, "\n\n").trim();
}

/** `<tag>content</tag>`, or "" when content is blank (so empty sections vanish). */
export function tag(name, content) {
	const c = normalizeHtml(content);
	return c ? `<${name}>${c}</${name}>` : "";
}

/**
 * Turn plain text (blank-line-separated) into `<p>` blocks. Text that already contains a
 * block-level tag is passed through untouched (it's already HTML).
 */
export function toParagraphs(text) {
	const t = normalizeHtml(text);
	if (!t) return "";
	if (/<(p|div|ul|ol|h[1-6]|table|blockquote)\b/i.test(t)) return t;
	return t.split(/\n{2,}/).map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Join section fragments, dropping blanks. */
export function joinSections(...fragments) {
	return fragments.map(normalizeHtml).filter(Boolean).join("\n");
}
