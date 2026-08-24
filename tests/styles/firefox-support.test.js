import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

// Foundry runs in Chromium on the desktop app but in whatever browser the player opens, and a
// sizeable share of players are on Firefox. A CSS feature Chromium ships and Gecko doesn't fails
// silently — the declaration is dropped and whatever it was taming runs loose.
//
// The one that bit us: `.stonetop-arcanum-card::before` used `mask-border` to 9-slice the card's
// chain frame. In Firefox the mask never applied, so the pseudo-element painted as an opaque
// --st-decor rectangle over the entire arcana tab. Chromium-only render probes cannot catch this,
// because in Chromium it works. So the check is a text contract on the stylesheet itself.
const BANNED = [
	{
		pattern: /(^|[\s;{])(-webkit-)?mask-(border|box-image)\b/m,
		name: "mask-border / -webkit-mask-box-image",
		reason: "unsupported in Firefox (Gecko keeps mask-border behind a pref and never shipped the "
			+ "-webkit- alias); use layered mask-image/-position/-size instead — see "
			+ ".stonetop-arcanum-card::before",
	},
];

const STYLES_DIR = path.resolve("styles");

async function findCss(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const found = await Promise.all(entries.map(async entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return findCss(full);
		return path.extname(entry.name) === ".css" ? [full] : [];
	}));
	return found.flat();
}

let stylesheets;

beforeAll(async () => {
	const files = await findCss(STYLES_DIR);
	stylesheets = await Promise.all(files.map(async file => ({
		file: path.relative(process.cwd(), file),
		// Comments name these properties to explain why we avoid them; only declarations count.
		css: (await fs.readFile(file, "utf8")).replace(/\/\*[\s\S]*?\*\//g, ""),
	})));
});

describe("shipped CSS avoids properties Firefox does not implement", () => {
	it("finds stylesheets to check", () => {
		expect(stylesheets.length).toBeGreaterThan(0);
	});

	for (const { pattern, name, reason } of BANNED) {
		it(`declares no ${name}`, () => {
			const offenders = stylesheets
				.filter(({ css }) => pattern.test(css))
				.map(({ file }) => file);
			expect(offenders, reason).toEqual([]);
		});
	}
});
