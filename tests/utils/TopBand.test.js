// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { TopBand, TopBandState, TOP_BAND_ACTIONS } from "../../src/utils/TopBand.js";

/**
 * The band's fold, as a component rather than a bare classList.toggle.
 *
 * Three things a one-liner could not do, all of which the rail already does and the band did not:
 * announce the state it is in, announce what pressing it will DO, and survive a render — an
 * ApplicationV2 part is rebuilt wholesale, so the class goes with the DOM it was written on.
 */
const markup = (collapsed = false) => `
<div class="sheet-wrapper${collapsed ? " top-collapsed" : ""}">
	<section class="sheet-top" id="s1-band">the numbers</section>
	<div class="stonetop-folded-ledger">the line</div>
	<button type="button" class="stonetop-top-toggle" aria-expanded="true"
	        data-label-show="Show the stats band" data-label-hide="Hide the stats band"></button>
</div>`;

const mount = (collapsed = false) => {
	const root = document.createElement("div");
	root.innerHTML = markup(collapsed);
	return root;
};

const wrapperIn = root => root.querySelector(".sheet-wrapper");
const toggleIn  = root => root.querySelector(".stonetop-top-toggle");

describe("TopBand", () => {
	it("finds the band from any control inside its wrapper", () => {
		const root = mount();
		expect(TopBand.from(toggleIn(root))).toBeInstanceOf(TopBand);
	});

	// A wrapper with no band is the NPC card and the steading, which share controls but not this
	// region. Folding a band that is not there would write a class nothing reads.
	it("is not found where there is no band to fold", () => {
		const root = document.createElement("div");
		root.innerHTML = `<div class="sheet-wrapper"><button class="stonetop-top-toggle"></button></div>`;
		expect(TopBand.from(root.querySelector("button"))).toBeNull();
	});

	it("takes its key from the region the toggle controls", () => {
		expect(new TopBand(wrapperIn(mount())).key).toBe("s1-band");
	});

	it("starts expanded and folds on toggle", () => {
		const root = mount();
		const band = new TopBand(wrapperIn(root));
		expect(band.isCollapsed).toBe(false);
		band.toggle();
		expect(band.isCollapsed).toBe(true);
		expect(wrapperIn(root).classList.contains("top-collapsed")).toBe(true);
		band.toggle();
		expect(band.isCollapsed).toBe(false);
	});

	// The half a classList.toggle cannot do: a disclosure has to say what it currently is, and what
	// pressing it will do next. Both wordings come off the button, so the util names nothing itself.
	it("announces the state and what pressing it will do", () => {
		const root = mount();
		const band = new TopBand(wrapperIn(root));
		const toggle = toggleIn(root);

		band.toggle();
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(toggle.getAttribute("aria-label")).toBe("Show the stats band");
		expect(toggle.getAttribute("title")).toBe("Show the stats band");

		band.toggle();
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(toggle.getAttribute("aria-label")).toBe("Hide the stats band");
	});

	it("corrects a toggle the template shipped saying the wrong thing", () => {
		const root = mount(true);
		toggleIn(root).setAttribute("aria-expanded", "true");
		new TopBand(wrapperIn(root)).syncToggle();
		expect(toggleIn(root).getAttribute("aria-expanded")).toBe("false");
	});

	it("says nothing it has not been given wordings for", () => {
		const root = mount();
		const toggle = toggleIn(root);
		delete toggle.dataset.labelHide;
		delete toggle.dataset.labelShow;
		toggle.setAttribute("aria-label", "left alone");
		new TopBand(wrapperIn(root)).syncToggle();
		expect(toggle.getAttribute("aria-label")).toBe("left alone");
		// The state is still announced — that one needs no wording.
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
	});
});

describe("TopBandState", () => {
	it("puts a folded band back in a freshly rendered tree", () => {
		const state = new TopBandState();
		const first = mount();
		const band = new TopBand(wrapperIn(first));
		band.toggle();
		state.remember(band);

		const fresh = mount();
		state.restore(fresh);
		expect(wrapperIn(fresh).classList.contains("top-collapsed")).toBe(true);
		expect(toggleIn(fresh).getAttribute("aria-expanded")).toBe("false");
	});

	it("leaves a band the reader has never touched as the template shipped it", () => {
		const fresh = mount();
		new TopBandState().restore(fresh);
		expect(wrapperIn(fresh).classList.contains("top-collapsed")).toBe(false);
		// …but the toggle is still made to say so, which is the one thing the template cannot know.
		expect(toggleIn(fresh).getAttribute("aria-expanded")).toBe("true");
	});

	it("restores an unfolded band as readily as a folded one", () => {
		const state = new TopBandState();
		const first = mount(true);
		const band = new TopBand(wrapperIn(first));
		band.toggle();
		state.remember(band);

		const fresh = mount(true);
		state.restore(fresh);
		expect(wrapperIn(fresh).classList.contains("top-collapsed")).toBe(false);
	});

	it("is idempotent", () => {
		const state = new TopBandState();
		const first = mount();
		const band = new TopBand(wrapperIn(first));
		band.toggle();
		state.remember(band);

		const fresh = mount();
		state.restore(fresh);
		state.restore(fresh);
		expect(wrapperIn(fresh).classList.contains("top-collapsed")).toBe(true);
	});

	// A wrapper with no band has no key, so it cannot be told apart from any other — remembering it
	// would fold whichever bandless sheet rendered next.
	it("ignores a wrapper with no band in it", () => {
		const root = document.createElement("div");
		root.innerHTML = `<div class="sheet-wrapper"><button class="stonetop-top-toggle"></button></div>`;
		expect(() => new TopBandState().restore(root)).not.toThrow();
		expect(root.querySelector(".stonetop-top-toggle").hasAttribute("aria-expanded")).toBe(false);
	});

	// The shape core actually hands `_syncPartState`: the new PART element, which IS the wrapper.
	// Searching descendants alone restored nothing on exactly the path the state exists for, and the
	// band sprang back open on every re-render — found by folding one in a running Foundry, not here.
	it("restores a tree whose own root is the wrapper", () => {
		const state = new TopBandState();
		const first = mount();
		const band = new TopBand(wrapperIn(first));
		band.toggle();
		state.remember(band);

		const asPartRoot = wrapperIn(mount());
		state.restore(asPartRoot);
		expect(asPartRoot.classList.contains("top-collapsed")).toBe(true);
		expect(asPartRoot.querySelector(".stonetop-top-toggle").getAttribute("aria-expanded")).toBe("false");
	});

	it("survives being handed nothing to restore into", () => {
		expect(() => new TopBandState().restore(null)).not.toThrow();
	});
});

describe("the toggleTop action", () => {
	it("folds the band and hands the result to the sheet's own memory", () => {
		const root = mount();
		const remembered = [];
		const sheet = { topBandState: { remember: band => remembered.push(band.isCollapsed) } };

		TOP_BAND_ACTIONS.toggleTop.call(sheet, {}, toggleIn(root));
		expect(wrapperIn(root).classList.contains("top-collapsed")).toBe(true);
		expect(remembered).toEqual([true]);
	});

	it("does nothing where there is no band", () => {
		const root = document.createElement("div");
		root.innerHTML = `<div class="sheet-wrapper"><button class="stonetop-top-toggle"></button></div>`;
		expect(() => TOP_BAND_ACTIONS.toggleTop.call({}, {}, root.querySelector("button"))).not.toThrow();
	});
});
