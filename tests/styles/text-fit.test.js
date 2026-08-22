import { describe, it, expect } from "vitest";
import path from "path";
import { RenderProbe, MeasuredElement, canProbe } from "./RenderProbe.js";

// Boxes that hold text, measured rather than asserted about.
//
// Raising the type scale is safe everywhere text sizes its own box and unsafe everywhere a box was
// hand-fitted in px to the size the text used to be. The second kind is invisible to a computed
// -style test — `height` still reports the px it was told, while the line inside it is cropped — so
// these read scrollHeight against clientHeight instead, at both ends of Foundry's font ladder.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

// Markup copied from the partials that emit these, because the rules are selector-specific and a
// simplified stand-in would silently stop matching them.
const FIXTURE = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  <div class="stonetop-tags" id="t-tags">
    <button type="button" class="stonetop-tag-chip is-selected" id="t-chip">group</button>
  </div>
  <div class="stonetop-intro-step" id="t-step">
    <span class="stonetop-intro-step-num" id="t-step-num">8</span>
    <p>Pick one of the other characters and tell them what you owe them.</p>
  </div>
  <button type="button" class="stonetop-view-toggle" id="t-toggle" data-view-state>
    <i class="fas fa-filter"></i><span>Selected only</span>
  </button>
  <nav class="sheet-tabs" id="t-tabs">
    <a class="item" id="t-tab">Moves</a>
  </nav>
  <div class="stonetop-debilities"><div class="stonetop-debility">
    <label class="stonetop-debility-control" id="t-debility">
      <span class="stonetop-debility-band">
        <span class="stonetop-debility-divider"></span>
        <input type="checkbox" class="stonetop-debility-check">
      </span>
      <span class="stonetop-debility-label" id="t-debility-label">shaky</span>
    </label>
  </div></div>
</div></div>`;

// Boxes that size themselves from their own text. These must fit at every step of the ladder.
const SCALING = {
	chip:    "#t-chip",
	stepNum: "#t-step-num",
	toggle:  "#t-toggle",
	tab:     "#t-tab",
	// Restructured out of the art-locked group: the divider is a mask that stretches to its band,
	// so the control now sizes from its own text like everything else here.
	debility:      "#t-debility",
	debilityLabel: "#t-debility-label"
};

/** The ends of core's font ladder, plus the default it ships. */
const FONT_STEPS = [8, 16, 32];

/** @returns {Map<string, MeasuredElement>} */
function fitAt(rootPx, targets) {
	return probe.measure({
		bodyHtml: FIXTURE,
		bodyClass: "theme-light",
		rootAttrs: `style="font-size: ${rootPx}px"`,
		targets
	});
}

function expectAllFit(measured) {
	for (const [name, el] of measured) {
		expect(el.missing, `${name} did not render`).toBe(false);
		expect(el.overflowY, `${name} crops ${el.overflowY}px of its own text`).toBe(0);
	}
}

describe.skipIf(!canProbe())("text fits its box", () => {
	it.each(FONT_STEPS)("at Foundry font size %ipx", rootPx => {
		expectAllFit(fitAt(rootPx, SCALING));
	});

});

describe("MeasuredElement", () => {
	const at = values => new MeasuredElement("x", values);
	const fitting = { contentWidth: 40, boxWidth: 40, contentHeight: 15, boxHeight: 15 };

	it("reports no overflow when content matches its box", () => {
		const el = at(fitting);
		expect(el.overflows).toBe(false);
		expect(el.overflowY).toBe(0);
		expect(el.overflowX).toBe(0);
	});

	it("reports vertical overflow and by how much", () => {
		const el = at({ ...fitting, contentHeight: 19 });
		expect(el.overflowsY).toBe(true);
		expect(el.overflows).toBe(true);
		expect(el.overflowY).toBe(4);
	});

	it("reports horizontal overflow and by how much", () => {
		const el = at({ ...fitting, contentWidth: 52 });
		expect(el.overflowsX).toBe(true);
		expect(el.overflows).toBe(true);
		expect(el.overflowX).toBe(12);
	});

	it("ignores measurement noise below the visible threshold", () => {
		// A line box a px over its container is font-metric rounding, not a crop a reader can see.
		const el = at({ ...fitting, contentHeight: 16 });
		expect(el.overflowY).toBe(0);
		expect(el.overflowsY).toBe(false);
	});

	it("never reports negative overflow when content is smaller than its box", () => {
		const el = at({ ...fitting, contentHeight: 10, contentWidth: 10 });
		expect(el.overflowY).toBe(0);
		expect(el.overflowX).toBe(0);
	});

	it("knows when its selector matched nothing", () => {
		expect(at({ __missing: true }).missing).toBe(true);
		expect(at(fitting).missing).toBe(false);
	});
});

// The move row body is shared: move-row.hbs renders it for the moves tab AND for the moves an
// arcanum card or a choice grants. The one intended difference between those surfaces is the
// acquisition checkbox, so it is the only thing the layout may differ by — and the description,
// which hangs under the move's NAME, has to follow that difference rather than assume it.
const MOVE_ROW = check => `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
  <ol class="items-list stonetop-arcanum-moves"><li class="stonetop-item">
    <div class="stonetop-item-header">
      ${check ? '<input type="checkbox" class="stonetop-item-check" checked>' : ""}
      <strong class="stonetop-item-name" id="m-name">Blood &amp; Bone</strong>
    </div>
    <div class="stonetop-item-requirement" id="m-req">Requires: the old power</div>
    <div class="stonetop-item-description" id="m-desc"><p>When you draw on it, roll +CON.</p></div>
  </li></ol>
</div></div>`;

describe.skipIf(!canProbe())("a move's description hangs under its name", () => {
	const leftEdges = check => {
		const m = probe.measure({
			bodyHtml: MOVE_ROW(check),
			bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			targets: { name: "#m-name", requirement: "#m-req", description: "#m-desc" }
		});
		return m;
	};

	it.each([
		["on an arcanum card, where the row has no checkbox", false],
		["in the moves tab, where the row has one", true]
	])("%s", (_label, check) => {
		const m = leftEdges(check);
		// Within a px: the name is bold display type and the description is prose, so their glyph
		// bearings differ slightly even when both start at the same offset.
		expect(m.get("description").textLeft).toBeCloseTo(m.get("name").textLeft, 0);
		expect(m.get("requirement").textLeft).toBeCloseTo(m.get("name").textLeft, 0);
	});

	it("indents both surfaces by exactly the checkbox they do or do not have", () => {
		const withCheck = leftEdges(true).get("description").textLeft;
		const without = leftEdges(false).get("description").textLeft;
		// 14px checkbox + the header's 6px gap.
		expect(withCheck - without).toBeCloseTo(20, 0);
	});
});

// Controls have to move with the text they belong to. A checkbox frozen at 14px beside a label that
// has doubled is no longer a pair, and one centred on a wrapped row floats to the middle of a
// two-line block instead of sitting beside the words it ticks.
const CONTROL_ROW = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content" style="width: 340px">
  <ol class="items-list"><li class="stonetop-item">
    <div class="stonetop-item-header">
      <input type="checkbox" class="stonetop-item-check" id="c-check" checked>
      <strong class="stonetop-item-name" id="c-name">A Long Move Name That Wraps Onto A Second Line</strong>
    </div>
  </li></ol>
  <div class="stonetop-inv-item">
    <span class="stonetop-inv-diamonds" id="c-gutter">
      <input type="checkbox" class="stonetop-inv-diamond" checked>
      <input type="checkbox" class="stonetop-inv-square">
    </span>
    <span class="stonetop-inv-label" id="c-label">Rations, three days of hard travel over the moor and back</span>
  </div>
</div></div>`;

describe.skipIf(!canProbe())("row controls", () => {
	const measure = rootPx => probe.measure({
		bodyHtml: CONTROL_ROW,
		bodyClass: "theme-light",
		rootAttrs: `style="font-size: ${rootPx}px"`,
		targets: { check: "#c-check", name: "#c-name", gutter: "#c-gutter", label: "#c-label" }
	});

	it.each(FONT_STEPS)("centre on the row's first line at Foundry font size %ipx", rootPx => {
		const m = measure(rootPx);
		// Within a px and a half: a line box's centre and a glyph run's centre differ by the font's
		// own asymmetric ascent and descent, which no offset can spend away.
		expect(Math.abs(m.get("check").boxMiddle - m.get("name").firstLineMiddle)).toBeLessThan(1.5);
		expect(Math.abs(m.get("gutter").boxMiddle - m.get("label").firstLineMiddle)).toBeLessThan(1.5);
	});

	it("scale with the font setting rather than staying pinned to a px", () => {
		const small = measure(8).get("check").values.boxHeight;
		const large = measure(32).get("check").values.boxHeight;
		expect(large).toBeCloseTo(small * 4, 0);
	});
});

// The NPC card's framed HP box. Its caption is a token and therefore already scaled, so the frame
// and the numerals had to as well — a px box around scaling text is the one combination that breaks.
const NPC_HP = `
<div class="application stonetop sheet actor npc themed theme-light"><div class="window-content">
  <div class="stonetop-follower-card stonetop-npc-card">
    <div class="stonetop-npc-header-row">
      <header class="sheet-header flexrow" id="n-header">
        <img class="profile-img" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">
        <div class="header-fields"><h1 class="charname" id="n-name">
          <input name="name" type="text" value="Hillfolk Raider"></h1></div>
      </header>
      <div class="stonetop-creature-hp" id="n-hp">
        <span class="stonetop-follower-label" id="n-hp-label">HP</span>
        <div class="stonetop-creature-hp__row">
          <span class="stonetop-stepper"><input class="stonetop-creature-hp__input" type="number" value="8"></span>
          <span>/</span>
          <span class="stonetop-stepper"><input class="stonetop-creature-hp__input" type="number" value="12"></span>
        </div>
      </div>
    </div>
  </div>
</div></div>`;

describe.skipIf(!canProbe())("the NPC card's HP box", () => {
	const at = rootPx => probe.measure({
		bodyHtml: NPC_HP,
		bodyClass: "theme-light",
		rootAttrs: `style="font-size: ${rootPx}px"`,
		targets: { hp: "#n-hp", label: "#n-hp-label", header: "#n-header", name: "#n-name" }
	});

	it.each(FONT_STEPS)("holds caption and numerals inside the frame at Foundry font size %ipx", rootPx => {
		const m = at(rootPx);
		const frame = m.get("hp");
		// The frame is the container that matters — the caption's own box is shorter than its
		// glyphs by design (the box sets line-height: 1 to tighten the numerals), which is a
		// typographic choice, not a crop.
		expect(frame.overflowY, `frame crops ${frame.overflowY}px`).toBe(0);
		expect(m.get("label").values.contentWidth).toBeLessThanOrEqual(frame.values.boxWidth);
	});

	it("scales the frame with the caption rather than holding it at a px", () => {
		const small = at(8).get("hp").values.boxWidth;
		const large = at(32).get("hp").values.boxWidth;
		expect(large).toBeCloseTo(small * 4, 0);
	});

});

// Core's .flexrow is `flex-wrap: wrap`, and a wrapping container decides its breaks from each item's
// flex-basis before shrinking anything. The name must narrow while there is room, and only drop
// under the portrait once there genuinely is not.
const HEADER_AT = width => `
<div class="application stonetop sheet actor npc themed theme-light" style="width: ${width}px">
  <div class="window-content"><div class="stonetop-follower-card stonetop-npc-card">
    <div class="stonetop-npc-header-row">
      <header class="sheet-header flexrow">
        <img class="profile-img" id="h-portrait" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">
        <div class="header-fields"><h1 class="charname" id="h-name">
          <input name="name" type="text" value="Hillfolk Raider"></h1></div>
      </header>
      <div class="stonetop-creature-hp"><span class="stonetop-follower-label">HP</span>
        <div class="stonetop-creature-hp__row">
          <input class="stonetop-creature-hp__input" type="number" value="8"></div></div>
    </div>
  </div></div>
</div>`;

describe.skipIf(!canProbe())("the actor header's name", () => {
	/**
	 * Wrapped means the name sits entirely BELOW the portrait. Header height cannot answer this —
	 * the header is as tall as the 100px portrait whether it wrapped or not.
	 */
	const wrapsAt = width => {
		const m = probe.measure({
			bodyHtml: HEADER_AT(width),
			bodyClass: "theme-light",
			rootAttrs: 'style="font-size: 16px"',
			targets: { portrait: "#h-portrait", name: "#h-name" }
		});
		const p = m.get("portrait").values;
		return m.get("name").values.boxTop >= p.boxTop + p.boxHeight - 1;
	};

	it("stays beside the portrait at the NPC card's own default width", () => {
		expect(wrapsAt(315)).toBe(false);
		expect(wrapsAt(400)).toBe(false);
	});

	it("still drops below the portrait once it genuinely cannot fit", () => {
		expect(wrapsAt(200)).toBe(true);
	});
});

// The swirl that replaces the list marker in rich text. It has to sit on the first line of its item
// at any font size — it was previously a 12px square nudged down by a hand-measured 0.28em, which
// held at one text size and slid off the line at every other.
const BULLET_LIST = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content" style="width: 300px">
  <div class="stonetop-item-description stonetop-rich">
    <ul id="b-list">
      <li id="b-short">Short item.</li>
      <li id="b-long">A much longer item that certainly runs onto more than a single line inside this column.</li>
    </ul>
  </div>
</div></div>`;

describe.skipIf(!canProbe())("rich-text bullets", () => {
	const bulletAt = rootPx => {
		const probes = {
			short: { selector: "#b-short", pseudo: "::before", properties: ["top", "width", "height", "left"] },
			long:  { selector: "#b-long",  pseudo: "::before", properties: ["top", "width", "height", "left"] },
			text:  { selector: "#b-short", properties: ["line-height", "font-size"] },
			list:  { selector: "#b-list",  properties: ["padding-left"] }
		};
		const p = probe.render({
			bodyHtml: BULLET_LIST,
			bodyClass: "theme-light",
			rootAttrs: `style="font-size: ${rootPx}px"`,
			probes
		});
		return p;
	};

	it.each(FONT_STEPS)("centre on the item's first line at Foundry font size %ipx", rootPx => {
		const p = bulletAt(rootPx);
		const lineHeight = parseFloat(p.get("text").get("line-height"));
		const size = parseFloat(p.get("short").get("width"));

		// The marker's centre must land on the centre of one line box of the item's own text.
		const expectedTop = (lineHeight - size) / 2;
		for (const name of ["short", "long"]) {
			expect(parseFloat(p.get(name).get("top")), `${name} @${rootPx}px`).toBeCloseTo(expectedTop, 1);
		}
	});

	it("keeps a wrapped item's marker on its first line, not the middle of the block", () => {
		const p = bulletAt(16);
		expect(parseFloat(p.get("long").get("top"))).toBeCloseTo(parseFloat(p.get("short").get("top")), 1);
	});

	it("scales the marker with the text rather than holding it at a px", () => {
		const small = parseFloat(bulletAt(8).get("short").get("width"));
		const large = parseFloat(bulletAt(32).get("short").get("width"));
		expect(large).toBeCloseTo(small * 4, 0);
	});

	it("indents the list by exactly the room the marker needs", () => {
		const p = bulletAt(16);
		const pad = parseFloat(p.get("list").get("padding-left"));
		const offset = Math.abs(parseFloat(p.get("short").get("left")));
		expect(pad).toBeCloseTo(offset, 1);
	});
});
