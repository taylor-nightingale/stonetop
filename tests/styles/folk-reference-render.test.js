import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe, fontAwesomeCss } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";
import { renderPartial } from "../fakes/renderTemplate.js";
import { Suggestion, SuggestionList } from "../../src/model/snapshot/steading/SuggestionSnapshot.js";
import { Person } from "../../src/actors/steading/Person.js";

/**
 * What the Folk tab's reference lists actually look like, measured.
 *
 * The claim the whole feature rests on is that a hundred names can each become a click target
 * WITHOUT the column turning into a hundred buttons. That is not a question the stylesheet can be
 * asked as text: the entries are real `<button>` elements — they have to be, because core binds
 * click for `[data-action]` only and a clickable span is keyboard-dead — and core's own
 * `.window-app button` rules give every one of them a border, a background, a full-width box and
 * core's UI font. Whether ours win is a question about the cascade, and only a browser knows.
 *
 * Three things are asserted here and nowhere else:
 *
 *  1. An entry computes as running text: no border, no background, the panel's own font, and inline
 *     so that a hundred of them wrap into a paragraph instead of stacking into a hundred rows.
 *  2. A used entry is visibly dimmer than a live one AND still legible. Dimming is the whole way
 *     "already taken" is shown, and a dim that fails contrast trades one problem for a worse one.
 *  3. The roster's six columns do not push the tab into a horizontal scroll at the width the tab
 *     actually gets.
 *
 * The fixtures are the REAL partials rendered from real snapshots. Hand-copied markup would be a
 * second description of the very selectors under test.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const sheet = f => path.join(STYLES, f);

const sheets = [
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
	// The roster's link chip is an icon in core's bordered frame; without the icon's real box the
	// chip measures as a frame around nothing.
	...(fontAwesomeCss() ? [fontAwesomeCss()] : []),
];

const probe = new RenderProbe(sheets);

const NAMES = ["Aderyn", "Aeronwen", "Afanen", "Afon", "Alun", "Andras", "Aneirin", "Awstin",
	"Bedwyr", "Berwyn", "Betrys", "Braith", "Briallen", "Bronwen", "Bryn", "Cadi", "Cadoc",
	"Cadwygan", "Caron", "Cefin", "Ceinwen", "Ceridwyn", "Cerys", "Colwyn", "Deiniol", "Dilwen",
	"Dylis", "Eifion", "Eirlys", "Eluned", "Emrys", "Enfys"];

// Bryn is used; the rest are not. Both states have to be in one fixture, so they can be compared.
const nameList = new SuggestionList("Names — Stonetop", SuggestionList.NAME,
	NAMES.map(label => new Suggestion(label, label === "Bryn")));

const traitList = new SuggestionList("Traits", SuggestionList.TRAIT, [
	new Suggestion("all thumbs"), new Suggestion("gets the best deals", true),
	new Suggestion("has a beef with Marshedge"), new Suggestion("knows all the gossip"),
]);

// The reference rail as the Folk tab renders it, in the width the tab's layout actually gives it.
// The theme rides on the SHEET, not only on <body>: Foundry stamps theme-light/theme-dark on the
// application element, and a fixture that hard-codes one renders the same page for both parchments —
// which would make the dark assertions below a duplicate of the light ones.
const referenceColumn = (theme = "theme-light") => `
<div class="application stonetop sheet actor steading themed ${theme}" style="width: 1180px">
 <div class="window-content"><div class="sheet-wrapper">
  <div class="stonetop-rail-layout">
   <div class="stonetop-rail-main steading-main">
    <section class="sheet-body"><div class="tab active" data-tab="folk">
    <div class="stonetop-rail-layout stonetop-rail-layout--end steading-folk-layout">
     <div class="stonetop-rail-main"><section class="steading-folk-roster steading-block"></section></div>
     <aside class="stonetop-rail steading-folk-ref">
       ${renderPartial("stonetop.steading-folk-suggestions", { list: nameList })}
       ${renderPartial("stonetop.steading-folk-suggestions", { list: traitList })}
     </aside>
    </div>
    </div></section>
   </div>
  </div>
 </div></div>
</div>`;

const ENTRY = ".steading-folk-ref .steading-folk-entry";
const PROPERTIES = ["display", "border-top-width", "border-top-style", "background-color", "color",
	"font-family", "font-size", "padding-left", "width", "text-align", "cursor"];

const styles = (bodyClass = "theme-light") => probe.render({
	bodyHtml: referenceColumn(bodyClass), bodyClass, rootAttrs: 'style="font-size: 16px"',
	probes: {
		live: { selector: `${ENTRY}:not(.is-used)`, properties: PROPERTIES },
		used: { selector: `${ENTRY}.is-used`,       properties: PROPERTIES },
		// The rail's sunken ground is what a dimmed entry has to stay readable against.
		panel: { selector: ".steading-folk-ref",    properties: ["background-color", "color", "font-family"] },
		para: { selector: ".steading-folk-entries", properties: ["color", "font-size", "--st-ink"] },
	},
	chromeFlags: ["--window-size=1300,1400"],
});

describe.skipIf(!canProbe())("a reference entry reads as text, not as a button", () => {
	let s;
	beforeAll(() => { s = styles(); });
	const el = name => s.get(name);

	it("renders both a live and a used entry", () => {
		expect(el("live").missing, "no live entry rendered").toBe(false);
		expect(el("used").missing, "no used entry rendered").toBe(false);
	});

	// Core's .window-app button rules are the thing being beaten here.
	it("has no border and no background of its own", () => {
		for (const name of ["live", "used"]) {
			expect(el(name).get("border-top-style"), `${name} entry has a border style`).toBe("none");
			expect(el(name).get("border-top-width"), `${name} entry has a border`).toBe("0px");
			expect(CssColor.parse(el(name).get("background-color")).alpha,
				`${name} entry paints a background`).toBe(0);
		}
	});

	// A hundred names have to wrap into a paragraph. Core stretches a button to its container.
	it("is inline, so the list wraps as running text rather than stacking", () => {
		expect(el("live").get("display")).toMatch(/^inline/);
		expect(el("live").get("text-align")).not.toBe("center");
	});

	it("wears the panel's own type, not core's UI font", () => {
		expect(el("live").get("font-family")).toBe(el("panel").get("font-family"));
	});

	// It is still a control: a pointer over a hundred words that do something has to say so.
	it("says it is clickable", () => {
		expect(el("live").get("cursor")).toBe("pointer");
	});
});

describe.skipIf(!canProbe())("a used entry dims without becoming unreadable", () => {
	// Dark parchment is the harder case for a dimmed ink, so both are checked.
	for (const [theme, bodyClass] of [["light parchment", "theme-light"], ["dark parchment", "theme-dark"]]) {
		describe(theme, () => {
			let s;
			beforeAll(() => { s = styles(bodyClass); });

			const paper = () => CssColor.parse(s.get("panel").get("background-color"));

			it("is visibly dimmer than an entry nobody has taken", () => {
				console.log("DBG", theme, "entry", s.get("live").get("color"), "para", s.get("para").get("color"), s.get("para").get("font-size"), s.get("para").get("--st-ink"));
				const live = CssColor.parse(s.get("live").get("color")).contrastWith(paper());
				const used = CssColor.parse(s.get("used").get("color")).contrastWith(paper());
				expect(used, "a used entry looks the same as a live one").toBeLessThan(live - 0.5);
			});

			// Dimmed, not removed — you still read down the list, so a used entry still has to be read.
			it("still clears AA for body text", () => {
				expect(CssColor.parse(s.get("used").get("color")).contrastWith(paper())).toBeGreaterThanOrEqual(4.5);
			});
		});
	}
});


// The roster grew a sixth column (Home) and lost the second table it used to share the tab with, so
// it now has to fit six columns of editable text in 1.55 of a two-column split. A text input's
// min-content width is not zero, so a grid of them is exactly the shape that stops narrowing and
// starts pushing the tab sideways — which no amount of reading the stylesheet will tell you.
const ROSTER_FOLK = [
	Person.fromRaw({ id: "a", name: "Bryn (she/her)", occupation: "publican", traits: "gets the best deals" }),
	Person.fromRaw({ id: "b", name: "Cadoc (he/him)", occupation: "smith", traits: "has a beef with Marshedge" }),
	Person.fromRaw({ id: "c", name: "Seadha (they/them)", home: "Marshedge", occupation: "trader", traits: "knows all the gossip, cheery, lived among the Forest Folk" }),
	// A LINKED row. `docLink` is enriched HTML the snapshot adds — the row itself stores a bare uuid —
	// so it is written here as Foundry renders it: an icon and the document's name in one anchor. The
	// name is what the roster has to stop drawing, and only a browser can say whether it did.
	{
		id: "d", name: "Aederyn (she/her)", home: "", occupation: "reeve", traits: "keeps the tallies",
		docLink: '<a class="content-link" draggable="true" data-uuid="Actor.x" data-type="Actor"><i class="fas fa-user"></i>Aederyn, Reeve of Stonetop</a>',
	},
];

// The rail is part of the fixture because the tab's width is the sheet's LESS the rail's, and that
// is the width the folk grid answers to.
// `moving` is RailSlide's mark and `railMargin` a frame of the slide: the probe paints no
// transitions, so a frame is set by hand.
const folkTab = (width, { refShut = false, moving = false, railMargin = null } = {}) => `
<div class="application stonetop sheet actor steading themed theme-light" style="width: ${width}px">
 <div class="window-content"><div class="sheet-wrapper">
  <div class="stonetop-rail-layout">
   <div class="stonetop-rail steading-rail"></div>
   <div class="stonetop-rail-main steading-main">
    <section class="sheet-body">
    <div class="tab active" data-tab="folk">
     <div class="stonetop-rail-layout stonetop-rail-layout--end steading-folk-layout${refShut ? " rail-shut" : ""}${moving ? " is-rail-moving" : ""}">
      <button type="button" class="stonetop-rail-toggle" aria-expanded="${!refShut}" aria-controls="s1-folk-reference">
       <i class="fas fa-chevron-right stonetop-rail-caret" aria-hidden="true"></i>
      </button>
      <div class="stonetop-rail-main">
       ${renderPartial("stonetop.steading-folk-roster", { folk: ROSTER_FOLK, isGM: true, actor: { name: "Stonetop" } })}
      </div>
      <aside class="stonetop-rail steading-folk-ref" id="s1-folk-reference"${railMargin === null ? "" : ` style="margin-right: ${railMargin}px"`}>
       ${renderPartial("stonetop.steading-folk-suggestions", { list: nameList })}
      </aside>
     </div>
    </div>
    </section>
   </div>
  </div>
 </div></div>
</div>`;

describe.skipIf(!canProbe())("the roster fits the tab it shares with the reference column", () => {
	// The sheet's own default width, and a narrow one — the drawer breakpoint (62.5rem of layout) is
	// just below this, so at 1030px the rail is still inline and the roster has about the least room
	// it ever gets with one.
	for (const width of [1180, 1030]) {
		describe(`${width}px`, () => {
			let m;
			beforeAll(() => {
				m = probe.measure({
					bodyHtml: folkTab(width), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
					targets: {
						grid:    ".steading-folk-layout",
						roster:  ".steading-folk-roster",
						table:   ".steading-folk-table",
						row:     '.steading-folk-row[data-id="c"]',
						// The row's real last column: the header's is the link heading, which is named
						// for assistive tech and drawn nowhere.
						lastCol: '.steading-folk-row[data-id="c"] .stonetop-person-remove',
						ref:     ".steading-folk-ref",
						linkCell: '.steading-folk-row[data-id="d"] .steading-doc-link',
						linkText: '.steading-folk-row[data-id="d"] .content-link',
						linkIcon: '.steading-folk-row[data-id="d"] .content-link i',
						unlink:   '.steading-folk-row[data-id="d"] .stonetop-person-unlink',
						nameCell: '.steading-folk-row[data-id="d"] .stonetop-person-name',
						traits:   '.steading-folk-row[data-id="c"] .stonetop-person-traits',
						shortRow: '.steading-folk-row[data-id="a"]',
						shortTraits: '.steading-folk-row[data-id="a"] .stonetop-person-traits',
					},
					chromeFlags: [`--window-size=${width + 120},1400`],
				});
			});

			const right = el => el.values.boxLeft + el.values.boxWidth;

			it("renders the roster beside the reference column", () => {
				for (const name of ["grid", "roster", "table", "row", "lastCol", "ref"]) {
					expect(m.get(name).missing, `${name} did not render`).toBe(false);
				}
			});

			// Six columns of editable text in 1.55 of a two-column split. A text input's min-content
			// width is not zero, so an `fr` track floors at roughly the twenty characters the user
			// agent sizes an input to — six of those put the roster ~100px past its own column here
			// and ~270px past it at 900, which is a scrollbar under the table rather than narrower
			// columns. minmax(0, …) on every flexible track is what stops that.
			it("keeps every column inside the roster, and the roster inside the tab", () => {
				expect(m.get("row").overflowX, "a roster row is wider than its own box").toBe(0);
				expect(right(m.get("lastCol")), "the last column runs past the roster")
					.toBeLessThanOrEqual(right(m.get("roster")) + 1);
				expect(right(m.get("roster")), "the roster runs past the tab")
					.toBeLessThanOrEqual(right(m.get("grid")) + 1);
				expect(right(m.get("ref")), "the reference column runs past the tab")
					.toBeLessThanOrEqual(right(m.get("grid")) + 1);
			});

			// The reference column is the smaller share, but it still has to be a column of text
			// rather than a gutter — the lists are read, not glanced at.
			it("leaves the reference column a readable measure", () => {
				expect(m.get("ref").values.boxWidth).toBeGreaterThan(m.get("grid").values.boxWidth * 0.3);
			});

			// The link column is a chip and a ✕. It used to be 5rem — the widest fixed thing on the
			// row, and at a narrow width wider than the Name cell — spent drawing a name the row is
			// already showing in an editable field two cells to the left.
			it("spends no more on the link column than the two controls in it", () => {
				const linkCell = m.get("linkCell").values;
				expect(linkCell.boxWidth, "the link column is wider than its controls")
					.toBeLessThan(m.get("nameCell").values.boxWidth);
				expect(m.get("linkText").values.boxWidth, "the chip is still drawing the document's name")
					.toBeLessThan(m.get("linkIcon").values.boxWidth * 2);
				// Icon and ✕ both still inside it: shrinking the column must not clip the control that
				// unlinks the row.
				expect(m.get("linkCell").overflowX, "the chip's controls are clipped").toBe(0);
				expect(right(m.get("unlink")), "the ✕ runs past the link column")
					.toBeLessThanOrEqual(right(m.get("linkCell")) + 1);
			});

			// The chip is core's bordered content-link. Squeezed narrower than its icon, the frame
			// stopped short and the icon hung out of its right side — a portrait drawn off its own box.
			it("draws the link's icon inside the chip's frame", () => {
				const chip = m.get("linkText").values;
				const icon = m.get("linkIcon").values;
				expect(icon.boxLeft, "the icon starts left of its frame").toBeGreaterThanOrEqual(chip.boxLeft);
				expect(right(m.get("linkIcon")), "the icon hangs out of its frame")
					.toBeLessThanOrEqual(right(m.get("linkText")));
			});

			// A list of traits is the one cell that cannot be read at a glance if it is cut: "knows all
			// the gossip, cheery, lived among the…" ends exactly where the interesting part starts.
			it("wraps a long traits cell instead of scrolling it out of sight", () => {
				const traits = m.get("traits").values;
				const short  = m.get("shortTraits").values;
				expect(traits.boxHeight, "the long traits cell did not wrap")
					.toBeGreaterThan(short.boxHeight + 1);
				// And the row grew with it rather than the text spilling out of the row's box.
				expect(m.get("row").values.boxHeight).toBeGreaterThanOrEqual(traits.boxHeight);
			});

			// One wrapped cell must not cost every roster row the height of the worst one.
			it("leaves the rows that fit at one line", () => {
				expect(m.get("shortRow").values.boxHeight)
					.toBeLessThan(m.get("row").values.boxHeight);
			});
		});
	}
});


/**
 * Thin sheets: the tab's two columns become two rows.
 *
 * Side by side, a narrow tab gives the roster six columns of editable text in about 300px while the
 * reference column keeps a third of the width to print names it could print just as well underneath.
 *
 * The fold is keyed to the TAB's width rather than the sheet's, and the two are not the same
 * question: with the rail inline the tab is 236px narrower than the window, and below the rail's own
 * breakpoint the rail drawers and hands all of that back at once.
 *
 * Which makes ORDER the thing to prove. The two thresholds have to fire in one direction only —
 * first the rail gets out of the way, then, if the window keeps narrowing, the lists go under the
 * roster. Set carelessly they interleave: the tab folds as it narrows and then unfolds a moment
 * later when the rail hides, so the lists jump back beside the roster on the way DOWN. That is a
 * relationship between two containers at two thresholds, which no reading of the stylesheet
 * resolves — each rule is obviously correct on its own.
 */
describe.skipIf(!canProbe())("the Folk tab on a thin sheet", () => {
	const measure = width => probe.measure({
		bodyHtml: folkTab(width), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
		targets: {
			grid:   ".steading-folk-layout",
			roster: ".steading-folk-roster",
			ref:    ".steading-folk-ref",
			row:    '.steading-folk-row[data-id="c"]',
			name:   '.steading-folk-row[data-id="c"] .stonetop-person-name',
		},
		chromeFlags: [`--window-size=${width + 120},1400`],
	});

	it("stacks the reference column under the roster", () => {
		const m = measure(560);
		const roster = m.get("roster").values;
		const ref    = m.get("ref").values;
		expect(ref.boxTop, "the lists are still beside the roster")
			.toBeGreaterThanOrEqual(roster.boxTop + roster.boxHeight - 1);
		expect(roster.boxWidth, "the roster did not take the tab's whole width")
			.toBeCloseTo(m.get("grid").values.boxWidth, 0);
	});

	// The point of stacking: the roster's own columns stop being unusable. A name cell narrower than
	// the delete button beside it is a roster you cannot read a name in. The floor is a readability
	// one, not a measurement: a folded rail takes a real strip out of this width now, so the cell is
	// some px narrower than it was and still holds a name, and so does the link column taking the
	// width its chip and ✕ actually need rather than a pinned one that squeezed the chip.
	it("gives the roster's name cell a usable width", () => {
		expect(measure(560).get("name").values.boxWidth).toBeGreaterThan(85);
	});

	const sideBySide = (m, why) => expect(m.get("ref").values.boxLeft, why)
		.toBeGreaterThan(m.get("roster").values.boxLeft + m.get("roster").values.boxWidth - 1);

	it("keeps the two columns side by side while the tab is wide enough", () => {
		sideBySide(measure(1180), "the tab folded at a width that fits both columns");
	});

	// The order this file exists for. Narrowing past the rail's breakpoint gives the tab 236px back;
	// at every width in that neighbourhood — with the rail inline, and just after it drawers — the
	// two columns have to still be two columns, or they fold and unfold as the window shrinks.
	it.each([1100, 1040, 1020, 1000, 960, 860, 760])("does not fold on the way down at %ipx", width => {
		sideBySide(measure(width), `the lists folded under the roster at ${width}px and will jump back`);
	});
});

// Put away from the tab on its edge, the rail slides out to the right and the roster has the tab.
describe.skipIf(!canProbe())("the reference rail put away", () => {
	let m;
	beforeAll(() => {
		m = probe.measure({
			bodyHtml: folkTab(1180, { refShut: true }), bodyClass: "theme-light", rootAttrs: 'style="font-size: 16px"',
			targets: {
				layout: ".steading-folk-layout",
				roster: ".steading-folk-roster",
				ref:    ".steading-folk-ref",
				toggle: ".steading-folk-layout > .stonetop-rail-toggle",
			},
			chromeFlags: ["--window-size=1300,1400"],
		});
	});

	const right = el => el.values.boxLeft + el.values.boxWidth;

	it("gives the roster the tab's whole width", () => {
		expect(m.get("roster").values.boxWidth).toBeGreaterThan(m.get("layout").values.boxWidth - 24);
	});

	it("slides the lists off the tab's end edge rather than folding them up", () => {
		expect(m.get("ref").values.boxLeft, "the shut rail is still on the tab")
			.toBeGreaterThanOrEqual(right(m.get("layout")) - 1);
	});

	it("leaves the tab on the edge to bring them back", () => {
		expect(m.get("toggle").missing, "the tab did not render").toBe(false);
		expect(Math.abs(right(m.get("toggle")) - right(m.get("layout"))), "the tab is not on the edge").toBeLessThan(2);
	});
});

// Mid-slide, the roster stays where it is and only its width changes: the room being made is the
// point. Held at one width, as the start rail's column is, its first columns slid off the tab's left
// edge and back.
describe.skipIf(!canProbe())("the reference rail sliding", () => {
	it("keeps the roster's start on the tab's edge while the rail moves", () => {
		const m = probe.measure({
			bodyHtml: folkTab(1180, { moving: true, railMargin: -150 }), bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			targets: { layout: ".steading-folk-layout", roster: ".steading-folk-roster" },
			chromeFlags: ["--window-size=1300,1400"],
		});
		expect(m.get("roster").values.boxLeft).toBeCloseTo(m.get("layout").values.boxLeft, 0);
	});
});
