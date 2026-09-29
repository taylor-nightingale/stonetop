// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { Disclosure, toggleSlidingDisclosure, toggleSwappingDisclosure } from "../../src/utils/Disclosure.js";
import { OpenDisclosures } from "../../src/utils/OpenDisclosures.js";

// A rail group, or a move row's text, slides open and shut rather than snapping. What the button says
// changes at once; the region stays on the page while it slides shut and takes `hidden` at the end.

function group({ open = false, gloss = false } = {}) {
	document.body.innerHTML = `
		<section data-disclosure-row class="row">
			<button type="button" data-disclosure aria-controls="body" aria-expanded="${open}"
			        data-label-show="Show the moves" data-label-hide="Hide the moves"
			        aria-label="${open ? "Hide" : "Show"} the moves">v</button>
			${gloss ? `<span class="gloss" data-disclosure-shut${open ? " hidden" : ""}>trigger</span>` : ""}
			<div id="body"${open ? "" : " hidden"}>
				<li data-disclosure-row class="inner">
					<span class="inner-gloss" data-disclosure-shut>inner trigger</span>
				</li>
			</div>
		</section>`;
	return {
		row:    document.querySelector("section"),
		toggle: document.querySelector("[data-disclosure]"),
		body:   document.getElementById("body"),
		gloss:  document.querySelector(".gloss"),
		inner:  document.querySelector(".inner-gloss"),
	};
}

// Without layout, happy-dom reports every box as 0px tall, so a slide has no distance to go and
// settles at once — the state it lands in is what these check.
const sheet = () => ({ openDisclosures: new OpenDisclosures() });
const press = (host, toggle) => toggleSlidingDisclosure.call(host, new Event("click"), toggle);
const settle = () => new Promise(r => setTimeout(r, 0));

describe("Disclosure — what the button says", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	// A region sliding shut is still on the page; the button already says it is shut, and that is
	// what the next press and the sheet's memory must read.
	it("reads open or shut off the button", () => {
		const { toggle, body } = group({ open: true });
		toggle.setAttribute("aria-expanded", "false");
		expect(body.hidden).toBe(false);
		expect(Disclosure.from(toggle).isOpen).toBe(false);
	});

	it("follows the state with its label when it carries both wordings", () => {
		const { toggle } = group({ open: false });
		Disclosure.from(toggle).setOpen(true);
		expect(toggle.getAttribute("aria-label")).toBe("Hide the moves");
		expect(toggle.title).toBe("Hide the moves");
	});

	it("hides what the row shows only while shut, and shows it again", () => {
		const { toggle, gloss } = group({ gloss: true });
		Disclosure.from(toggle).setOpen(true);
		expect(gloss.hidden).toBe(true);
		Disclosure.from(toggle).setOpen(false);
		expect(gloss.hidden).toBe(false);
	});

	// A group holds move rows that have glosses of their own; opening the group is not opening them.
	it("leaves a nested row's own shut-only parts alone", () => {
		const { toggle, inner } = group({ gloss: true });
		Disclosure.from(toggle).setOpen(true);
		expect(inner.hidden).toBe(false);
	});
});

describe("toggleSlidingDisclosure", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("opens a shut region and says so at once", async () => {
		const { toggle, body, row } = group({ open: false });
		press(sheet(), toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(row.classList.contains("is-open")).toBe(true);
		expect(toggle.getAttribute("aria-label")).toBe("Hide the moves");
		await settle();
		expect(body.hidden).toBe(false);
	});

	it("shuts an open region, hiding it once the slide is done", async () => {
		const { toggle, body } = group({ open: true });
		press(sheet(), toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		await settle();
		expect(body.hidden).toBe(true);
	});

	it("brings the gloss back as the text goes, and takes it away as the text comes", async () => {
		const { toggle, gloss } = group({ open: false, gloss: true });
		const host = sheet();
		press(host, toggle);
		await settle();
		expect(gloss.hidden).toBe(true);
		press(host, toggle);
		await settle();
		expect(gloss.hidden).toBe(false);
	});

	it("tells the sheet what the region now is, so a redraw puts it back", async () => {
		const { toggle } = group({ open: false });
		const host = sheet();
		press(host, toggle);
		group({ open: false });
		host.openDisclosures.restore(document.body);
		expect(document.getElementById("body").hidden).toBe(false);
		expect(document.querySelector("[data-disclosure]").getAttribute("aria-expanded")).toBe("true");
	});

	it("does nothing for a button that controls nothing", () => {
		document.body.innerHTML = `<button type="button" id="loose" aria-controls="nope">x</button>`;
		expect(() => press(sheet(), document.getElementById("loose"))).not.toThrow();
	});
});

// A section's door says "Done" while it is open and "Change" while it is shut, and its bar carries
// the book's instruction only while choosing — the mirror of the gloss that shows only while shut.
describe("Disclosure — what shows only while open", () => {
	function section({ open = false } = {}) {
		document.body.innerHTML = `
			<section data-disclosure-row>
				<span class="note" data-disclosure-open${open ? "" : " hidden"}>(Choose 1)</span>
				<button type="button" data-disclosure aria-controls="body" aria-expanded="${open}">
					<span class="change" data-disclosure-shut${open ? " hidden" : ""}>Change</span>
					<span class="done" data-disclosure-open${open ? "" : " hidden"}>Done</span>
				</button>
				<div id="body"${open ? "" : " hidden"}>
					<li data-disclosure-row><span class="inner" data-disclosure-open hidden>inner</span></li>
				</div>
			</section>`;
		const q = s => document.querySelector(s);
		return { toggle: q("[data-disclosure]"), note: q(".note"), change: q(".change"), done: q(".done"), inner: q(".inner") };
	}

	beforeEach(() => { document.body.innerHTML = ""; });

	it("shows its open-only parts as it opens, and its shut-only parts go", async () => {
		const s = section();
		press(sheet(), s.toggle);
		await settle();
		expect([s.note.hidden, s.done.hidden, s.change.hidden]).toEqual([false, false, true]);
	});

	it("hides them again as it shuts", async () => {
		const s = section({ open: true });
		press(sheet(), s.toggle);
		await settle();
		expect([s.note.hidden, s.done.hidden, s.change.hidden]).toEqual([true, true, false]);
	});

	it("puts them back on a restore, without sliding", () => {
		const s = section();
		new Disclosure(s.toggle, document.getElementById("body")).setOpen(true);
		expect([s.note.hidden, s.done.hidden]).toEqual([false, false]);
	});

	it("leaves a nested row's own parts alone", async () => {
		const s = section();
		press(sheet(), s.toggle);
		await settle();
		expect(s.inner.hidden).toBe(true);
	});
});

// A section's door is not a region sliding in under the rest: it trades what the section says at rest
// for everything on offer. Sliding both bodies at once put the two on screen together, and slid the
// door's own word out as if it were content, so "Change" hung on beside "Done". So everything the
// door changes changes at once, and the panel's height is what eases.
describe("toggleSwappingDisclosure", () => {
	function door({ open = false, heights = [80, 240] } = {}) {
		document.body.innerHTML = `
			<section data-disclosure-row class="panel">
				<button type="button" data-disclosure aria-controls="choose" aria-expanded="${open}">
					<span class="change" data-disclosure-shut${open ? " hidden" : ""}>Change</span>
					<span class="done" data-disclosure-open${open ? "" : " hidden"}>Done</span>
				</button>
				<div class="rest" data-disclosure-shut${open ? " hidden" : ""}>chosen</div>
				<div id="choose"${open ? "" : " hidden"}>on offer</div>
			</section>`;
		const q = s => document.querySelector(s);
		const panel = q(".panel");
		// happy-dom lays nothing out: the panel is as tall as whichever body is showing.
		Object.defineProperty(panel, "offsetHeight", { get: () => heights[q("#choose").hidden ? 0 : 1] });
		return { panel, toggle: q("[data-disclosure]"), change: q(".change"), done: q(".done"), rest: q(".rest"), choose: q("#choose") };
	}
	const swap = (host, toggle) => toggleSwappingDisclosure.call(host, new Event("click"), toggle);

	beforeEach(() => { document.body.innerHTML = ""; });

	it("changes the word and the bodies at once", () => {
		const d = door();
		swap(sheet(), d.toggle);
		expect([d.change.hidden, d.done.hidden, d.rest.hidden, d.choose.hidden]).toEqual([true, false, true, false]);
		expect(d.toggle.getAttribute("aria-expanded")).toBe("true");
	});

	it("changes them back at once", () => {
		const d = door({ open: true });
		swap(sheet(), d.toggle);
		expect([d.change.hidden, d.done.hidden, d.rest.hidden, d.choose.hidden]).toEqual([false, true, false, true]);
	});

	it("eases the panel from the height it had to the height it has, and neither body", () => {
		const d = door();
		swap(sheet(), d.toggle);
		expect(d.panel.style.height).toBe("240px");
		expect(d.panel.style.transition).toContain("height");
		expect(d.rest.style.height).toBe("");
		expect(d.choose.style.height).toBe("");
	});

	it("tells the sheet what the section now is, so a redraw puts it back", () => {
		const d = door();
		const host = sheet();
		swap(host, d.toggle);
		door();
		host.openDisclosures.restore(document.body);
		expect(document.getElementById("choose").hidden).toBe(false);
	});

	it("does nothing for a button that controls nothing", () => {
		document.body.innerHTML = `<button type="button" id="loose" aria-controls="nope">x</button>`;
		expect(() => swap(sheet(), document.getElementById("loose"))).not.toThrow();
	});
});

// A Moves panel's bar carries both its caret and its door. The door's words and its resting list are
// the row's; the caret only opens and shuts the panel, so it must leave them alone.
describe("a caret that controls its region only", () => {
	function panel() {
		document.body.innerHTML = `
			<section data-disclosure-row class="panel">
				<button type="button" class="door" data-disclosure aria-controls="choose" aria-expanded="false">
					<span class="change" data-disclosure-shut>Change</span><span class="done" data-disclosure-open hidden>Done</span>
				</button>
				<button type="button" class="caret" data-disclosure data-disclosure-region-only aria-controls="body" aria-expanded="false">v</button>
				<div id="body" hidden><div class="rest" data-disclosure-shut>taken</div><div id="choose" hidden>on offer</div></div>
			</section>`;
		const q = s => document.querySelector(s);
		return { panel: q(".panel"), caret: q(".caret"), change: q(".change"), done: q(".done"), rest: q(".rest"), body: q("#body") };
	}

	beforeEach(() => { document.body.innerHTML = ""; });

	it("opens the panel and leaves the door's words, its resting list and the row alone", async () => {
		const p = panel();
		press(sheet(), p.caret);
		await settle();
		expect(p.body.hidden).toBe(false);
		expect(p.caret.getAttribute("aria-expanded")).toBe("true");
		expect([p.change.hidden, p.done.hidden, p.rest.hidden]).toEqual([false, true, false]);
		expect(p.panel.classList.contains("is-open")).toBe(false);
	});

	it("is put back on a restore the same way", () => {
		const p = panel();
		Disclosure.from(p.caret).setOpen(true);
		expect([p.change.hidden, p.done.hidden, p.rest.hidden]).toEqual([false, true, false]);
	});
});
