// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { DebilitySnapshot, RatingSnapshot } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { SteadingDefaults } from "../../../src/model/data/steading/SteadingDefaults.js";
import { RollModes } from "../../../src/actors/RollModes.js";

const STEADING_TEMPLATE = "systems/stonetop/templates/actor/steading.hbs";

const TABS = ["play", "folk", "season", "content"]
	.map((id, i) => ({ id, label: `stonetop.steading.tabs.${id}`, active: i === 0, cssClass: i === 0 ? "active" : "" }));

function renderHeader(overrides = {}) {
	const html = renderTemplate(STEADING_TEMPLATE, {
		editable: true,
		tabs: TABS,
		sheetIdPrefix: "steading-42",
		actor: { name: "Stonetop" },
		availableSteadfasts: [],
		stonetop: {
			debilities: ["diminished", "lacking", "malcontent"].map((slug, i) => new DebilitySnapshot(slug, i === 1)),
			rollModes: RollModes.options("normal"),
			fortunes: new RatingSnapshot(SteadingDefaults.fortunes, { current: 2 }),
			surplus:  new RatingSnapshot(SteadingDefaults.surplus,  { current: 3 }),
			attributes: Object.fromEntries(Object.entries(SteadingDefaults.attributes)
				.map(([slug, def]) => [slug, new RatingSnapshot(def, { current: slug === "size" ? "village" : 1 })])),
			assets: { items: [], coinage: [] },
			...overrides,
		},
	});
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
}

// The line is already minimal, so there is nothing left to fold — the collapse that made sense
// against a 224 px header would now be a control that changes nothing. The one collapse control on
// the sheet belongs to the RAIL, and it lives outside the line.
it("ships no collapse control on the line itself", () => {
	const root = renderHeader();
	expect(root.querySelector(".steading-line [data-action='toggleRail']")).toBeNull();
	expect(root.querySelector(".stonetop-rail-layout > [data-action='toggleRail']")).not.toBeNull();
});

describe("the rail", () => {
	// The rail owns the two ratings the book crowns and the moves you roll; the band owns the four it
	// rules plainly. Divided by KIND, so each question has exactly one answer.
	it("carries the arch pair", () => {
		const arched = [...renderHeader().querySelectorAll(".steading-rail .steading-archpair .steading-tile")];
		expect(arched.map(t => t.dataset.attr)).toEqual(["fortunes", "surplus"]);
	});

	// The whole argument that makes a rail safe here: collapsing it must not take a rating off the
	// screen. So the line renders Fortunes and Surplus unconditionally and a container query hides
	// them while the rail is showing them — there is no state to get wrong and nothing to run.
	it("leaves its two ratings on the line, marked, rather than moving them", () => {
		const railed = [...renderHeader().querySelectorAll(".steading-line .steading-railed")];
		expect(railed.map(t => t.dataset.attr)).toEqual(["fortunes", "surplus"]);
	});

	// SC 2.4.11: a drawer that overlays the tab must be a real button that says whether it is open.
	it("is disclosed by a real button that reports its state and names its rail", () => {
		const root   = renderHeader();
		const toggle = root.querySelector("[data-action='toggleRail']");
		const rail   = root.querySelector(".stonetop-rail");
		expect(toggle.tagName).toBe("BUTTON");
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(toggle.getAttribute("aria-controls")).toBe(rail.id);
		expect(toggle.hasAttribute("aria-label")).toBe(true);
		// Reading the rail is not an edit, so it stays live on a locked sheet.
		expect(toggle.hasAttribute("data-view-state")).toBe(true);
	});

	// A steading has all six homefront moves from the day it exists. A tick that can never be
	// cleared asserts a state that does not exist, and costs a column of a 220px rail.
	it("gives its moves no acquisition checkbox", () => {
		expect(renderHeader().querySelector(".steading-rail .stonetop-item-check")).toBeNull();
	});
});

describe("the steading header — tab navigation", () => {
	it("is a tablist, not seven loose buttons", () => {
		const nav = renderHeader().querySelector("nav.sheet-tabs");
		expect(nav.getAttribute("role")).toBe("tablist");
		expect(nav.hasAttribute("aria-label")).toBe(true);
	});

	it("marks which tab is selected, and keeps only that one in the tab order", () => {
		const tabs = [...renderHeader().querySelectorAll('[role="tab"]')];
		expect(tabs.length).toBe(4);
		expect(tabs[0].getAttribute("aria-selected")).toBe("true");
		expect(tabs[0].getAttribute("tabindex")).toBe("0");
		expect(tabs[1].getAttribute("aria-selected")).toBe("false");
		expect(tabs[1].getAttribute("tabindex")).toBe("-1");
	});

	it("points each tab at the panel it opens", () => {
		const root = renderHeader();
		for (const tab of root.querySelectorAll('[role="tab"]')) {
			const panel = root.querySelector(`#${tab.getAttribute("aria-controls")}`);
			expect(panel, `no panel for ${tab.dataset.tab}`).not.toBeNull();
			expect(panel.getAttribute("role")).toBe("tabpanel");
			expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
		}
	});

	// Two steadings open at once must not mint the same ids.
	it("scopes its ids to the application", () => {
		expect(renderHeader().querySelector('[role="tab"]').id).toContain("steading-42");
	});

	it("keeps core's own tab action wired", () => {
		const tab = renderHeader().querySelector('[role="tab"]');
		expect(tab.getAttribute("data-action")).toBe("tab");
		expect(tab.getAttribute("data-group")).toBe("primary");
	});
});

describe("the steading header — debilities", () => {
	// The whole point of the line: "what does diminished do?" is answerable from the sheet, by
	// reading it. Foundry's tooltips are pointer-only and invisible to assistive tech, so the effect
	// has to be in the DOM as text.
	it("states what each debility does, marked or not", () => {
		const texts = [...renderHeader().querySelectorAll(".steading-debility-text")].map(el => el.textContent);
		expect(texts.length).toBe(3);
		for (const slug of ["diminished", "lacking", "malcontent"]) {
			expect(texts.some(t => t.includes(`stonetop.steading.debilities.${slug}.effect`))).toBe(true);
		}
	});

	it("marks the active one with a class, not colour alone", () => {
		const active = [...renderHeader().querySelectorAll(".steading-debility.is-active")];
		expect(active.length).toBe(1);
		expect(active[0].querySelector("input").dataset.slug).toBe("lacking");
		expect(active[0].querySelector("input").checked).toBe(true);
	});
});

describe("the steading header — roll mode", () => {
	it("groups its radios so they are announced as one control", () => {
		const fieldset = renderHeader().querySelector("fieldset.steading-rollmode");
		expect(fieldset).not.toBeNull();
		expect(fieldset.querySelector("legend").textContent.trim()).toBe("stonetop.rollMode.label");
	});

	it("draws the shared three modes, in the shared order", () => {
		const values = [...renderHeader().querySelectorAll(".steading-rollmode-input")].map(i => i.value);
		expect(values).toEqual(RollModes.options().map(o => o.key));
	});

	it("ticks the current mode", () => {
		const root = renderHeader({ rollModes: RollModes.options("dis") });
		const checked = root.querySelector(".steading-rollmode-input[checked]");
		expect(checked.value).toBe("dis");
		expect(checked.closest(".steading-rollmode-option").classList.contains("is-checked")).toBe(true);
	});
});

describe("the steading line — one component, two densities", () => {
	// F's whole claim is that the line and the Play tab's full treatment are the SAME component at
	// two densities. The moment one is a separate compact copy they drift, and F has quietly become
	// two headers. The density is an attribute on the container; the ratings are one partial.
	it("marks its density on the container rather than forking the markup", () => {
		const line = renderHeader().querySelector(".steading-line");
		expect(line.dataset.density).toBe("line");
	});

	// Size is not here: it is a CATEGORY, not a quantity, and it has its own shape — a pill beside
	// the name, not a sixth number in a row of numbers.
	it("renders each quantity exactly once on the line", () => {
		const attrs = [...renderHeader().querySelectorAll(".steading-line .steading-tile")].map(t => t.dataset.attr);
		expect(attrs).toEqual(["fortunes", "surplus", "population", "prosperity", "defenses"]);
	});

	it("gives Size a pill rather than a tile", () => {
		const root = renderHeader();
		expect(root.querySelector(".steading-line .steading-tile[data-attr='size']")).toBeNull();
		const pill = root.querySelector(".steading-size-pill");
		expect(pill).not.toBeNull();
		// Still a real control, still bound by the class the steadfast sheet reads.
		expect(pill.querySelector("select.steading-attr-input")?.dataset.attr).toBe("size");
	});

	// The claim, stated as a test: the Play tab does not get a compact copy of its own. It renders
	// the same partial — same classes, same roll button, same editable input — at the other density.
	it("renders the full density from the same partial, not a second one", () => {
		const grid = renderHeader().querySelector(".stonetop-rail-layout");
		const attrs = [...grid.querySelectorAll('[data-density="full"] .steading-tile')].map(t => t.dataset.attr);
		expect(attrs).toEqual(["fortunes", "surplus", "prosperity", "defenses"]);
		for (const attr of attrs) {
			const tile = grid.querySelector(`.steading-tile[data-attr="${attr}"]`);
			// The class the steadfast sheet binds by — see steadfast-rating-bindings.test.js.
			expect(tile.querySelector(".steading-attr-input"), `${attr} is not editable at full density`).not.toBeNull();
		}
	});

	// Fortunes and Surplus are the two the book crowns; the other four get a plain rule. The arch is
	// the full density's alone — at line height the woodcut is a smudge.
	it("arches only the two ratings the book arches, and only at full density", () => {
		const root = renderHeader();
		const arched = [...root.querySelectorAll(".steading-tile--arched")].map(t => t.dataset.attr);
		expect(arched).toEqual(["fortunes", "surplus"]);
		for (const attr of arched) {
			expect(root.querySelector(`.steading-archpair .steading-tile[data-attr="${attr}"] .steading-tile-badge`)).not.toBeNull();
		}
	});

	// Prosperity leads Resources and Defenses leads Fortifications — the pairing is the book's best
	// structural idea, and it is only true if the rating and its list share a column.
	it("puts each rating at the head of the evidence that justifies it", () => {
		const columns = [...renderHeader().querySelectorAll(".steading-play-grid .steading-overview-column")];
		const pairing = columns.map(c => [
			c.querySelector(".steading-tile")?.dataset.attr,
			c.querySelector(".steading-attr-list [data-attr]")?.dataset.attr,
		]);
		// Two columns, not three: Fortunes and Surplus lead no list, so they went to the rail and
		// what is left on Play is exactly the book's pairing.
		expect(pairing).toEqual([["prosperity", "prosperity"], ["defenses", "defenses"]]);
	});

	// The reason the seam matters in practice: because the roll button lives in the shared partial,
	// it is present at BOTH densities, so rolling from the collapsed line needs no second code path.
	it("lets every rollable rating be rolled from the line", () => {
		const root = renderHeader();
		for (const attr of ["fortunes", "population", "prosperity", "defenses"]) {
			const button = root.querySelector(`.steading-tile[data-attr="${attr}"] button[data-roll]`);
			expect(button, `${attr} has no roll target in the line`).not.toBeNull();
			expect(button.dataset.roll).toBe(attr);
			expect(button.classList.contains("rollable")).toBe(true);
		}
	});

	// Surplus is a store, not a roll — the book gives it no move.
	it("offers no roll on a rating nothing rolls", () => {
		const surplus = renderHeader().querySelector('.steading-tile[data-attr="surplus"]');
		expect(surplus.querySelector("button[data-roll]")).toBeNull();
	});

	it("names the roll for what it does, not just what it is", () => {
		const button = renderHeader().querySelector('.steading-tile[data-attr="defenses"] button[data-roll]');
		expect(button.getAttribute("aria-label")).toContain("Roll");
	});
});
