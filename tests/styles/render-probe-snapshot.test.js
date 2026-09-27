import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The screenshot half of the probe.
 *
 * `snapshot` exists so a figure in a design document is the REAL partials under the REAL
 * stylesheets rather than a drawing of them — every mockup hand-drawn for the sheet redesign was
 * wrong about something the templates already do. These tests hold it to the two promises that
 * makes it worth having: it writes an actual PNG, and it builds the same page the probes measure.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe([
	path.join(STYLES, "themes/palette.css"),
	path.join(STYLES, "themes/parchment-light.css"),
	path.join(STYLES, "tokens.css"),
	path.join(STYLES, "stonetop.css"),
]);

const FIXTURE = `<div class="application stonetop sheet actor character themed theme-light"
     style="width: 400px"><div class="window-content"><div class="sheet-wrapper">
  <h1 class="charname"><input name="name" type="text" value="Denl"></h1>
</div></div></div>`;

describe.skipIf(!canProbe())("RenderProbe.snapshot", () => {
	let dir;
	beforeAll(() => { dir = mkdtempSync(path.join(tmpdir(), "stonetop-shot-")); });
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	// One launch, both promises. Two tests meant two headless Chromes, and thirty other probe files
	// are starting their own — the second one lost that race under a full-suite run and nothing else.
	it("writes a PNG and returns its path", () => {
		const out = path.join(dir, "shot.png");

		expect(probe.snapshot({ bodyHtml: FIXTURE, bodyClass: "game themed theme-light", outFile: out,
			width: 420, height: 160 })).toBe(out);
		expect(existsSync(out)).toBe(true);
		// The PNG signature, so an empty or truncated file cannot pass.
		expect([...readFileSync(out).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
	});

	// The reason _page was extracted: a screenshot assembled differently from the fixture the
	// probes measure would be a picture of a page nothing has ever asserted on.
	it("builds the same page the probes measure", () => {
		const args = { bodyHtml: "<p>x</p>", bodyClass: "game", rootAttrs: 'style="font-size: 16px"',
			sheets: "<style>p{color:red}</style>", base: "<base href='file:///tmp/'>" };
		const page = probe._page(args);

		expect(page.startsWith("<!doctype html>")).toBe(true);
		expect(page).toContain('<html style="font-size: 16px">');
		expect(page).toContain('<body class="game">');
		expect(page).toContain(args.base);
		expect(page).toContain(args.sheets);
		expect(page).toContain("<p>x</p>");
		// The layer order is declared before any sheet, which is what pins our @layer system
		// to the eighth slot instead of whichever one parsing order happens to give it.
		expect(page.indexOf("@layer reset,")).toBeLessThan(page.indexOf(args.sheets));
	});

	it("omits the probe script when no script is asked for", () => {
		expect(probe._page({ bodyHtml: "", bodyClass: "", rootAttrs: "", sheets: "", base: "" }))
			.not.toContain("probe-result");
	});
});
