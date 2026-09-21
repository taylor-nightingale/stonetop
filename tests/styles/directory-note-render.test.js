import { describe, it, expect } from "vitest";
import path from "path";
import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";
import { createStonetopActorDirectoryClass } from "../../src/actors/StonetopActorDirectory.js";

// The playbook written beside a character's name in the Actors tab.
//
// Two things have to hold at once and they pull against each other: it has to RECEDE, so the names
// still read as the list, and it has to be READABLE, because it is information rather than
// decoration. Measured in both themes against the sidebar's own background, which is the surface it
// actually sits on — not the sheet paper the rest of the file is checked against.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

// The REAL row, from the file the directory points at, inside core's own sidebar shape.
//
// Hand-written markup is what let a layout bug through here once already: core ships
// `.flexrow > * { flex: 1 }`, which reaches every child of the row — and a fixture carrying inline
// flex styles of its own never felt it. Anything the browser is asked about has to be the markup
// that ships.
const ROW = Handlebars.compile(readFileSync(
	path.resolve(createStonetopActorDirectoryClass(class {})._entryPartial.replace("systems/stonetop/", "")), "utf8"));

// A 1x1 transparent GIF: core sizes the thumbnail itself (--sidebar-item-height), and the row's
// proportions are what these measure.
const THUMB = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const row = (name, directoryNote) => ROW({ id: "a1", name, directoryNote, thumbnail: THUMB },
	{ data: { root: { documentCls: "actor" } } });

const sidebar = (rows, width = 300) => `
<section id="actors" class="tab sidebar-tab actors-sidebar directory flexcol themed" style="width:${width}px">
  <ol class="directory-list plain">${rows}</ol>
</section>`;

const FIXTURE = sidebar(row("Anwen", "The Would-Be Hero"))
	.replace('class="entry-name ellipsis"', 'class="entry-name ellipsis" id="probe-name"')
	.replace('class="stonetop-directory-note"', 'class="stonetop-directory-note" id="probe-note"');

const probed = theme => probe.render({
	bodyHtml: FIXTURE.replace("themed", `themed theme-${theme}`),
	bodyClass: `theme-${theme}`,
	rootAttrs: 'style="font-size: 16px"',
	probes: {
		note: { selector: "#probe-note", properties: ["color", "font-style", "font-size", "text-overflow"] },
		name: { selector: "#probe-name", properties: ["color", "font-size"] },
		sidebar: { selector: "#actors", properties: ["background-color"] },
	},
});

describe.skipIf(!canProbe())("the playbook beside a name in the Actors tab", () => {
	it.each([["light"], ["dark"]])("recedes behind the name in the %s theme", theme => {
		const read = probed(theme);
		const note = CssColor.parse(read.get("note").get("color"));
		const name = CssColor.parse(read.get("name").get("color"));
		const paper = CssColor.parse(read.get("sidebar").get("background-color"));

		// Fainter than the name against the same background — "faded" as a measured fact, not a token
		// somebody meant to be faint.
		expect(note.contrastWith(paper)).toBeLessThan(name.contrastWith(paper));
		expect(parseFloat(read.get("note").get("font-size")))
			.toBeLessThan(parseFloat(read.get("name").get("font-size")));
	});

	it.each([["light"], ["dark"]])("stays readable in the %s theme", theme => {
		const read = probed(theme);
		const note = CssColor.parse(read.get("note").get("color"));
		const paper = CssColor.parse(read.get("sidebar").get("background-color"));

		// WCAG AA for large text / non-text UI. It is a gloss, not body copy, but a reader has to be
		// able to tell one playbook from another at a glance.
		expect(note.contrastWith(paper)).toBeGreaterThanOrEqual(3);
	});

	it("speaks in the masthead's voice", () => {
		expect(probed("light").get("note").get("font-style")).toBe("italic");
	});

	it("ellipses rather than wrapping", () => {
		expect(probed("light").get("note").get("text-overflow")).toBe("ellipsis");
	});
});

// Core gives `.entry-name` a zero flex basis, which means it absorbs every pixel of a row's overflow
// no matter what the items beside it are told to do: without a cap, a long name is ellipsed down to
// nothing while the playbook keeps its full width. The cap is the only thing that divides a row
// neither of them fits in — and it has to stay out of the way of every row that does.
//
// Measured at core's REAL sidebar metrics (foundry2.css: --sidebar-width 300px,
// --sidebar-item-height 48px for the thumbnail, 8px gap), because the cap is a proportion of the
// row and a fixture without the thumbnail measures a row that does not exist.
describe.skipIf(!canProbe())("how a row divides", () => {
	const measure = (width, name, note = "The Would-Be Hero") => probe.measure({
		bodyHtml: sidebar(row(name, note), width),
		bodyClass: "theme-light",
		rootAttrs: 'style="font-size: 16px"',
		targets: { name: ".entry-name", note: ".stonetop-directory-note", row: ".directory-item" },
	});

	// Core's `.flexrow > * { flex: 1 }` reaches our span too: left alone, the note is grown to an
	// equal share of the row rather than taking the width of the words in it.
	it("takes the width of its own text, not a share of the row", () => {
		const short = measure(300, "Bryn", "The Hero").get("note").values.boxWidth;
		const long  = measure(300, "Anwen").get("note").values.boxWidth;
		expect(short).toBeLessThan(long * 0.7);
	});

	// The longest playbook title in the book, at the width every player's sidebar opens to.
	it("shows the longest playbook name in full at the default sidebar width", () => {
		expect(measure(300, "Anwen").get("note").overflowsX).toBe(false);
	});

	// And not written into the corner of the screen: core's row ends flush against the sidebar's own
	// edge, so the standoff is ours to add.
	it("stands off the sidebar's right edge", () => {
		const measured = measure(300, "Anwen");
		const note = measured.get("note").values;
		const rowBox = measured.get("row").values;
		const standoff = (rowBox.boxLeft + rowBox.boxWidth) - (note.boxLeft + note.boxWidth);
		expect(standoff).toBeGreaterThanOrEqual(6);
	});

	// Half the row would clip the longest title; the name still keeps a readable share.
	it("divides a row neither of them fits, rather than starving the name", () => {
		const measured = measure(180, "Hafgan the Unfriendly Innkeeper");
		const name = measured.get("name").values.boxWidth;
		const note = measured.get("note").values.boxWidth;
		expect(name).toBeGreaterThan(0.3 * (name + note));
	});
});
