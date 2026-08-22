// Finds colour literals in a stylesheet. The theming contract (helper/theming-plan.md) is that
// structural CSS names a role — var(--st-ink) — and only a theme file says what colour that role
// is. This is what measures compliance: 262 literals in 78 distinct values is what one stylesheet
// with no colour vocabulary looks like, and four interchangeable border greys is what it costs.

// Named colours are matched in value position only; the lookarounds are what keep `white-space`
// from reading as the colour `white`.
const NAMED_COLORS = [
	"aliceblue", "antiquewhite", "azure", "beige", "bisque", "black", "blanchedalmond", "blue",
	"brown", "burlywood", "cadetblue", "chocolate", "coral", "cornsilk", "crimson", "cyan",
	"darkblue", "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkred", "darkslategray",
	"darkslategrey", "dimgray", "dimgrey", "firebrick", "floralwhite", "gainsboro", "gold",
	"goldenrod", "gray", "green", "grey", "honeydew", "indigo", "ivory", "khaki", "lavender",
	"lightgray", "lightgrey", "limegreen", "linen", "magenta", "maroon", "navy", "oldlace",
	"olive", "orange", "orchid", "peru", "pink", "plum", "purple", "red", "rosybrown",
	"saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver", "slateblue",
	"slategray", "slategrey", "snow", "steelblue", "tan", "teal", "thistle", "tomato", "violet",
	"wheat", "white", "whitesmoke", "yellow"
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNCTIONAL = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/;
const NAMED = new RegExp(`(?<![-\\w#])(?:${NAMED_COLORS.join("|")})(?![-\\w])`);

const ANY_COLOR = new RegExp(`${HEX.source}|${FUNCTIONAL.source}|${NAMED.source}`, "gi");

/** One colour literal, and where it was written. */
export class ColorLiteral {
	/**
	 * @param {string} value the literal exactly as authored
	 * @param {number} line 1-based line number in the stylesheet
	 */
	constructor(value, line) {
		this.value = value;
		this.line = line;
	}

	/** Comparable form: `RGBA( 0, 0, 0, .5 )` and `rgba(0,0,0,.5)` are the same literal. */
	get normalized() {
		return this.value.toLowerCase().replace(/\s+/g, "");
	}
}

/** Every colour literal found in one stylesheet, asked about as a whole. */
export class ColorLiteralScan {
	/** @param {ColorLiteral[]} literals */
	constructor(literals) {
		this._literals = literals;
	}

	/** @param {string} css raw stylesheet text */
	static fromCss(css) {
		const source = blankOut(css);
		const literals = [];
		for (const match of source.matchAll(ANY_COLOR)) {
			literals.push(new ColorLiteral(match[0], lineOf(source, match.index)));
		}
		return new ColorLiteralScan(literals);
	}

	/** @returns {ColorLiteral[]} */
	get all() {
		return [...this._literals];
	}

	get count() {
		return this._literals.length;
	}

	/** @returns {string[]} normalized values, sorted, one entry each */
	get distinctValues() {
		return [...new Set(this._literals.map(l => l.normalized))].sort();
	}

	/** @returns {Map<string, number>} normalized value → how often it appears */
	countsByValue() {
		const counts = new Map();
		for (const literal of this._literals) {
			counts.set(literal.normalized, (counts.get(literal.normalized) ?? 0) + 1);
		}
		return counts;
	}

	/** The literals whose value is not in `allowed` — i.e. what the contract would reject. */
	violations(allowed) {
		const permitted = new Set(allowed);
		return this._literals.filter(l => !permitted.has(l.normalized));
	}
}

// Comments and url() payloads are replaced by same-length blanks rather than removed, so every
// match index still maps to the line the literal was actually written on.
function blankOut(css) {
	const blank = text => text.replace(/[^\n]/g, " ");
	return css
		.replace(/\/\*[\s\S]*?\*\//g, blank)
		.replace(/url\([^)]*\)/gi, blank);
}

function lineOf(source, index) {
	let line = 1;
	for (let i = 0; i < index; i++) if (source[i] === "\n") line++;
	return line;
}
