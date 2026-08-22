import { execFileSync } from "child_process";
import { writeFileSync, mkdtempSync, existsSync, readdirSync } from "fs";
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

export class RenderProbe {
	/**
	 * @param {string[]} stylesheets absolute paths, applied in order after core's
	 */
	constructor(stylesheets) {
		this._stylesheets = stylesheets;
	}

	/**
	 * Render `bodyHtml` and read computed styles.
	 *
	 * @param {object} options
	 * @param {string} options.bodyHtml markup placed inside <body>
	 * @param {string} [options.bodyClass] classes on <body> — this is how a theme is selected
	 * @param {string} [options.rootAttrs] extra attributes on <html>
	 * @param {Record<string,{selector: string, properties: string[]}>} options.probes
	 * @returns {Map<string, ProbedElement>}
	 */
	render({ bodyHtml, bodyClass = "", rootAttrs = "", probes }) {
		const chrome = chromePath();
		if (!chrome || !foundryCss) throw new Error("RenderProbe needs Chrome and a local Foundry install");

		const links = [foundryCss, ...this._stylesheets]
			.map(f => `<link rel="stylesheet" href="file://${f}">`).join("\n");

		const html = `<!doctype html><html ${rootAttrs}><head><meta charset="utf-8">${links}</head>
<body class="${bodyClass}">
${bodyHtml}
<pre id="probe-result"></pre>
<script>
const probes = ${JSON.stringify(probes)};
const out = {};
for (const [name, spec] of Object.entries(probes)) {
  const el = document.querySelector(spec.selector);
  if (!el) { out[name] = { __missing: true }; continue; }
  const cs = getComputedStyle(el);
  const values = {};
  for (const prop of spec.properties) values[prop] = cs.getPropertyValue(prop).trim();
  out[name] = values;
}
document.getElementById("probe-result").textContent = JSON.stringify(out);
</script>
</body></html>`;

		const dir = mkdtempSync(path.join(tmpdir(), "stonetop-probe-"));
		const file = path.join(dir, "fixture.html");
		writeFileSync(file, html);

		const dom = execFileSync(chrome, [
			"--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
			"--virtual-time-budget=4000", "--dump-dom", `file://${file}`
		], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60000 });

		const match = /<pre id="probe-result">([\s\S]*?)<\/pre>/.exec(dom);
		if (!match) throw new Error("RenderProbe: fixture produced no result element");

		const parsed = JSON.parse(decodeEntities(match[1]));
		return new Map(Object.entries(parsed).map(([name, values]) => [name, new ProbedElement(name, values)]));
	}
}

function decodeEntities(text) {
	return text
		.replace(/&quot;/g, '"').replace(/&#34;/g, '"')
		.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}
