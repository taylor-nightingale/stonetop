/**
 * The snapshot's rich text, read two ways. A field arrives as `{ raw, html }` or as a bare string, and
 * every module that draws one needs the same two answers from it.
 */
import { RichText } from "../../../src/model/snapshot/RichText.js";

/** What is drawn — a RichText renders the way the sheet's `{{rich}}` helper renders it. */
export function html(field) {
	if (field instanceof RichText) return field.render();
	if (field && typeof field === "object") return field.html ?? field.raw ?? "";
	return field ?? "";
}

/** The plain-text side — for a count, a title attribute, an aria-label. */
export const plain = field => String(field && typeof field === "object" ? field.raw ?? "" : field ?? "").trim();

const isCapturedRich = value => typeof value.raw === "string" && "html" in value && "autoRoll" in value;

/**
 * The capture's rich text as RichText again.
 *
 * JSON keeps a RichText's fields and loses its class, and the shipped code the deck reuses asks
 * `instanceof RichText` — handed a plain one, `rich()` makes "[object Object]" of it. So whatever is
 * passed to shipped code is walked first: each captured rich field comes back as the class, with the
 * html it was enriched to, and everything else comes back as it was.
 */
export function rehydrate(value) {
	if (Array.isArray(value)) return value.map(rehydrate);
	if (!value || typeof value !== "object") return value;
	if (isCapturedRich(value)) return Object.assign(new RichText(value.raw, value.autoRoll), { html: value.html ?? null });
	return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, rehydrate(v)]));
}
