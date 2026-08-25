import { execFileSync } from "child_process";
import { writeFileSync, readFileSync, mkdtempSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Renders a fixture in real Chrome and reports what the CSS actually computed to.
//
// Why this exists: the other tests in this directory parse the stylesheet as text. They can prove a
// token is declared and that every var() resolves to something declared somewhere — and they proved
// exactly that while the theme was visibly broken, six times running. Text cannot answer the
// question that matters: given core's stylesheet, its cascade layers, and ours on top, what colour
// does this element actually end up? Only a browser engine knows.
//
// The failure they missed is worth naming, because it is the reason for every rule below. The
// Foundry bridge was first declared on `:root`. Cascade layers only arbitrate between declarations
// targeting the SAME element, and an element's own declaration always beats an inherited one — so
// core's `body.theme-dark { --color-text-primary }` simply won on body, and the whole bridge was
// inert. Every text-based assertion still passed.

const CHROME_CANDIDATES = [
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/opt/google/chrome/chrome"
];

/** Newest local Foundry install, so the probe runs against core's real stylesheet. */
function findFoundryCss() {
	const home = process.env.HOME ?? "";
	const installs = existsSync(home)
		? readdirSync(home).filter(d => /^FoundryVTT/.test(d)).sort().reverse()
		: [];
	for (const dir of installs) {
		const css = path.join(home, dir, "resources/app/public/css/foundry2.css");
		if (existsSync(css)) return css;
	}
	return null;
}

export const chromePath = () => CHROME_CANDIDATES.find(existsSync) ?? null;
export const foundryCss = findFoundryCss();

/** True when this machine can run the probe at all. Tests skip rather than fail without it. */
export const canProbe = () => Boolean(chromePath() && foundryCss);

/**
 * One element's computed values.
 * Named rather than a bare object so a probe result reads as a thing, not a bag.
 */
export class ProbedElement {
	/** @param {string} name @param {Record<string,string>} values */
	constructor(name, values) {
		this.name = name;
		this.values = values;
	}

	/** @returns {string} the computed value of one property, trimmed */
	get(property) {
		return this.values[property] ?? "";
	}

	get missing() {
		return this.values.__missing === true;
	}
}

/**
 * One element's rendered geometry.
 *
 * Sibling to {@link ProbedElement}: computed styles answer "what did the cascade decide", this
 * answers "did the result fit". A box hand-fitted in px to a font size clips when the type scale
 * moves, and no computed-style assertion can see that — `height` still reports the px it was told.
 */
export class MeasuredElement {
	/** @param {string} name @param {Record<string,number|boolean>} values */
	constructor(name, values) {
		this.name = name;
		this.values = values;
	}

	get missing() {
		return this.values.__missing === true;
	}

	/**
	 * How many px of content did not fit vertically inside the element's content box.
	 * A number rather than a bare boolean, because "crops 4px" localises the fix and "true" does not.
	 *
	 * Sub-pixel differences are not overflow: layout rounding routinely puts a line box a fraction
	 * of a px over its container without a pixel of it being lost.
	 */
	get overflowY() {
		return visibleOverflow(this.values.contentHeight - this.values.boxHeight);
	}

	get overflowX() {
		return visibleOverflow(this.values.contentWidth - this.values.boxWidth);
	}

	/**
	 * Viewport x of the element's first glyph, not of its box — two elements whose boxes line up
	 * still read as misaligned when one of them is indented, and it is the text a reader sees.
	 */
	get textLeft() {
		return this.values.contentLeft;
	}

	/** Vertical centre of the element's own box, in viewport px. */
	get boxMiddle() {
		return this.values.boxTop + this.values.boxHeight / 2;
	}

	/**
	 * Vertical centre of the element's FIRST line of text. What a control has to line up with:
	 * centring against the whole element puts the tick in the middle of a wrapped block instead of
	 * beside the words it ticks.
	 */
	get firstLineMiddle() {
		return this.values.firstLineTop + this.values.firstLineHeight / 2;
	}

	/** Content taller than the box that holds it — the shape a clipped line of text takes. */
	get overflowsY() {
		return this.overflowY > 0;
	}

	/** Content wider than the box that holds it. */
	get overflowsX() {
		return this.overflowX > 0;
	}

	get overflows() {
		return this.overflowsY || this.overflowsX;
	}
}

/**
 * A `transformCss` that turns a pseudo-class into a plain class of the same name, so a state Chrome
 * will not enter on its own can still be probed: headless Chrome has no cursor, and there is no way
 * to force :hover through the screenshot/dump interface.
 *
 * Sound because a pseudo-class and a class have identical specificity, and the rewrite leaves every
 * rule inside its own @layer — so the cascade the probe resolves is the real one. It must be applied
 * to core's stylesheet as well as ours, which is the whole reason it lives on the probe: a rewrite
 * of our sheets alone silently stops core's rules from applying at all, and the probe then reports
 * that everything is fine.
 */
export const pseudoAsClass = pseudo => css => css.replaceAll(`:${pseudo}`, `.is-${pseudo}`);

export class RenderProbe {
	/**
	 * @param {string[]} stylesheets absolute paths, applied in order after core's
	 * @param {object} [options]
	 * @param {(css: string) => string} [options.transformCss] rewrites EVERY stylesheet, core's
	 *   included, before the page loads them. See {@link pseudoAsClass}.
	 */
	constructor(stylesheets, { transformCss } = {}) {
		this._stylesheets = stylesheets;
		this._transformCss = transformCss;
		this._transformed = null;
	}

	/** The stylesheet paths to link, applying `transformCss` to copies on first use. */
	_sheetPaths() {
		const all = [foundryCss, ...this._stylesheets];
		if (!this._transformCss) return all;
		if (!this._transformed) {
			const dir = mkdtempSync(path.join(tmpdir(), "stonetop-probe-css-"));
			this._transformed = all.map((f, i) => {
				// Flat names keep url(../assets/…) from resolving, which is fine: a transformed probe
				// asks about the cascade (colour, layout), never about which image loaded.
				const out = path.join(dir, `${String(i).padStart(2, "0")}-${path.basename(f)}`);
				writeFileSync(out, this._transformCss(readFileSync(f, "utf8")));
				return out;
			});
		}
		return this._transformed;
	}

	/**
	 * Render `bodyHtml` and read computed styles.
	 *
	 * @param {object} options
	 * @param {string} options.bodyHtml markup placed inside <body>
	 * @param {string} [options.bodyClass] classes on <body> — this is how a theme is selected
	 * @param {string} [options.rootAttrs] extra attributes on <html>
	 * @param {Record<string,{selector: string, properties: string[], pseudo?: string}>} options.probes
	 * @param {string[]} [options.chromeFlags] extra Chrome flags, e.g. --force-prefers-reduced-motion
	 * @returns {Map<string, ProbedElement>}
	 */
	render({ bodyHtml, bodyClass = "", rootAttrs = "", probes, chromeFlags = [] }) {
		const collect = `
const probes = ${JSON.stringify(probes)};
for (const [name, spec] of Object.entries(probes)) {
  const el = document.querySelector(spec.selector);
  if (!el) { out[name] = { __missing: true }; continue; }
  // A pseudo-element has no node to query, but it does have a computed style — which is the only
  // way to assert anything about a ::before marker.
  const cs = getComputedStyle(el, spec.pseudo || null);
  const values = {};
  for (const prop of spec.properties) values[prop] = cs.getPropertyValue(prop).trim();
  out[name] = values;
}`;
		return this._collect({ bodyHtml, bodyClass, rootAttrs, collect, chromeFlags, Element: ProbedElement });
	}

	/**
	 * Render `bodyHtml` and read rendered geometry.
	 *
	 * @param {object} options
	 * @param {string} options.bodyHtml markup placed inside <body>
	 * @param {string} [options.bodyClass] classes on <body>
	 * @param {string} [options.rootAttrs] extra attributes on <html> — `style="font-size: 24px"`
	 *   here is how a Foundry Font Size step is simulated, since core sets exactly that.
	 * @param {Record<string,string>} options.targets name → selector
	 * @returns {Map<string, MeasuredElement>}
	 */
	measure({ bodyHtml, bodyClass = "", rootAttrs = "", targets, chromeFlags = [] }) {
		const collect = `
const targets = ${JSON.stringify(targets)};
for (const [name, selector] of Object.entries(targets)) {
  const el = document.querySelector(selector);
  if (!el) { out[name] = { __missing: true }; continue; }
  // A Range over the element's own contents, because scrollHeight cannot see overflow that a
  // centring container throws out of BOTH edges — the exact shape of a cropped line of text in a
  // flex box with align-items: center, which is most of this sheet's chips and badges.
  //
  // Compared against the BORDER box, not the content box: a line-height of 1 deliberately sets a
  // line box shorter than the font's natural one and lets the glyphs use the padding, which is a
  // typographic choice, not a crop. The border box is what the reader sees as "the thing", so
  // text leaving it is the failure worth naming.
  const range = document.createRange();
  range.selectNodeContents(el);
  const content = range.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  // getClientRects()[0] is the FIRST line box specifically. A wrapped element's bounding rect
  // spans every line, and "the control sits beside the first line" is not a claim about the block.
  const first = range.getClientRects()[0];
  out[name] = {
    contentWidth: content.width, contentHeight: content.height,
    boxWidth: box.width, boxHeight: box.height,
    contentLeft: content.left, boxLeft: box.left,
    boxTop: box.top,
    firstLineTop: first ? first.top : content.top,
    firstLineHeight: first ? first.height : content.height
  };
}`;
		return this._collect({ bodyHtml, bodyClass, rootAttrs, collect, chromeFlags, Element: MeasuredElement });
	}

	/**
	 * Build the fixture, run headless Chrome over it, and read back whatever `collect` wrote
	 * into `out`. Shared so render() and measure() cannot drift in how they set the page up —
	 * the stylesheet order and the <html> attributes are the whole point of the probe.
	 *
	 * @returns {Map<string, ProbedElement|MeasuredElement>}
	 */
	_collect({ bodyHtml, bodyClass, rootAttrs, collect, Element, chromeFlags = [] }) {
		const chrome = chromePath();
		if (!chrome || !foundryCss) throw new Error("RenderProbe needs Chrome and a local Foundry install");

		const links = this._sheetPaths()
			.map(f => `<link rel="stylesheet" href="file://${f}">`).join("\n");

		const html = `<!doctype html><html ${rootAttrs}><head><meta charset="utf-8">${links}</head>
<body class="${bodyClass}">
${bodyHtml}
<pre id="probe-result"></pre>
<script>
const out = {};
${collect}
document.getElementById("probe-result").textContent = JSON.stringify(out);
</script>
</body></html>`;

		const dir = mkdtempSync(path.join(tmpdir(), "stonetop-probe-"));
		const file = path.join(dir, "fixture.html");
		writeFileSync(file, html);

		const dom = execFileSync(chrome, [
			"--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
			// Flags that put the BROWSER in a state the CSS reacts to — a media query cannot be
			// reached from the page, so emulating it is the only way to assert on one.
			...chromeFlags,
			"--virtual-time-budget=4000", "--dump-dom", `file://${file}`
		], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60000 });

		const match = /<pre id="probe-result">([\s\S]*?)<\/pre>/.exec(dom);
		if (!match) throw new Error("RenderProbe: fixture produced no result element");

		const parsed = JSON.parse(decodeEntities(match[1]));
		return new Map(Object.entries(parsed).map(([name, values]) => [name, new Element(name, values)]));
	}
}

/**
 * Rounds away measurement noise, so only a visible crop counts as overflow.
 *
 * The floor is 2px rather than 0 because a Range's rect is derived from font metrics, and which
 * metrics apply depends on whether a webfont finished loading — a difference that moves a line box
 * by a px and moves nothing a reader can see. Every genuine crop this probe has found was 4px or
 * more, so the floor costs no sensitivity.
 */
const NOISE_FLOOR_PX = 2;

function visibleOverflow(overflow) {
	return overflow >= NOISE_FLOOR_PX ? Math.round(overflow) : 0;
}

function decodeEntities(text) {
	return text
		.replace(/&quot;/g, '"').replace(/&#34;/g, '"')
		.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}
