/**
 * Markup as one line of plain words, for anything that is read rather than rendered: a gloss, a
 * tooltip.
 *
 * A BLOCK boundary becomes a space, because two blocks are two runs of words with nothing between
 * them; an inline tag becomes nothing at all, because it sits inside a sentence and a space in its
 * place puts one before the comma that follows ("on a 10+ , it works").
 */
export function plainText(html) {
	const spaced = String(html ?? "")
		.replace(/<\/?(p|div|ul|ol|li|h[1-6]|blockquote|table|tr|td|th|pre|section|figure|br)\b[^>]*>/gi, " ")
		.replace(/<[^>]+>/g, "");
	return decode(spaced).replace(/\s+/g, " ").trim();
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

function decode(text) {
	return text.replace(/&(#\d+|[a-z]+);/gi, (whole, name) => {
		const known = ENTITIES[name.toLowerCase()];
		if (known !== undefined) return known;
		return /^#\d+$/.test(name) ? String.fromCodePoint(Number(name.slice(1))) : whole;
	});
}
