import snarkdown from "../../lib/snarkdown.es.js";

// Tags whose rendered box already ends the line, so a <br> next to one would add an empty line.
const BLOCK_TAGS   = "ul|ol|li|h[1-6]|blockquote|pre|table|tr|td|hr|p|div";
const STARTS_BLOCK = new RegExp(`^<(?:${BLOCK_TAGS})\\b`, "i");
const ENDS_BLOCK   = new RegExp(`(?:</(?:${BLOCK_TAGS})>|<(?:hr|br)\\s*/?>)$`, "i");
// Newlines snarkdown leaves BETWEEN block tags are markup whitespace, not authored line breaks.
const TAG_NEWLINE  = new RegExp(`(</(?:${BLOCK_TAGS})>)\\n|\\n(?=<(?:${BLOCK_TAGS})\\b)`, "gi");
const BLANK_LINE   = /\n\s*\n/;
const PRE_REGION   = /<pre[\s\S]*?<\/pre>/gi;
// Private-use sentinel, distinct from the token sentinel in enrichGameText.
const PRE_MARK     = /\uf8fe(\d+)\uf8fe/g;
// A run of two or more underscores is a fill-in-the-blank the reader completes at the table, never
// emphasis: game text writes bold as `**` and italic as `_x_`.
const BLANK        = /_{2,}/g;
// Its own sentinel, carrying the run's length so restoring needs no side table.
const BLANK_MARK   = /\uf8fd(\d+)\uf8fd/g;

/**
 * Newlines an author typed inside one block are line breaks — snarkdown passes them through as
 * literal "\n", which HTML then collapses to a space. Code blocks keep their own newlines (they
 * are rendered in a <pre>, where whitespace is already significant).
 */
function softBreaks(html) {
	const pres = [];
	return html
		.replace(PRE_REGION, m => `\uf8fe${pres.push(m) - 1}\uf8fe`)
		.replace(TAG_NEWLINE, "$1")
		.replace(/\n/g, "<br />")
		.replace(PRE_MARK, (_, i) => pres[Number(i)]);
}

/**
 * Hide fill-in-the-blanks from the markdown pass. snarkdown reads every underscore run as an
 * emphasis delimiter and closes whatever is still open at the end of the block, so "bearing ___’s
 * crest" loses the blank and bolds the rest of the line.
 */
function shieldBlanks(md) {
	return md.replace(BLANK, run => `\uf8fd${run.length}\uf8fd`);
}

function restoreBlanks(html) {
	return html.replace(BLANK_MARK, (_, length) => "_".repeat(Number(length)));
}

/**
 * Markdown → one HTML string per blank-line-separated block, with authored line breaks preserved.
 *
 * Blocks are rendered separately because snarkdown collapses a run of newlines to a single <br>,
 * which loses the difference between a new line and a new paragraph — and because the two callers
 * want different things between blocks: the display path joins them ({@link joinBlocks}), the
 * ProseMirror seed wraps each in a <p>.
 */
export function markdownBlocks(md) {
	return (md ?? "")
		.split(BLANK_LINE)
		.map(block => restoreBlanks(softBreaks(snarkdown(shieldBlanks(block.trim())))))
		.filter(html => html.trim().length > 0);
}

/** True when rendered block HTML opens with a block-level element. */
export function startsBlock(html) {
	return STARTS_BLOCK.test(html);
}

/**
 * Join rendered blocks for inline display: a blank line between two runs of prose, nothing where a
 * block-level element already breaks the line.
 */
export function joinBlocks(blocks) {
	return blocks.reduce((html, block) => {
		if (!html) return block;
		const gap = ENDS_BLOCK.test(html) || startsBlock(block) ? "" : "<br /><br />";
		return html + gap + block;
	}, "");
}
