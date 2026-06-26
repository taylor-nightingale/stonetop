import { describe, expect, it, beforeAll, beforeEach } from "vitest";

// share-journal.js is DOM/Foundry wiring, but two decisions are worth guarding:
// which `ownership.default` level the two checkboxes resolve to, and that the
// header button is added once, only for GMs, only on a JournalEntry, with its
// icon/tooltip reflecting the current shared state. The test env is node, so we
// fake just the surface the module touches (mirroring restrict-content-links).

// ── Minimal fake DOM ─────────────────────────────────────────────────────────
class FakeClassList {
	constructor() { this.set = new Set(); }
	add(...c) { c.forEach(x => x && this.set.add(x)); }
	remove(...c) { c.forEach(x => this.set.delete(x)); }
	contains(c) { return this.set.has(c); }
	toggle(c, force) {
		const on = force === undefined ? !this.set.has(c) : !!force;
		if (on) this.set.add(c); else this.set.delete(c);
		return on;
	}
}

class FakeEl {
	constructor(tag) {
		this.tagName = (tag || "div").toUpperCase();
		this.children = [];
		this.attrs = {};
		this.listeners = [];
		this.classList = new FakeClassList();
		this._innerHTML = "";
	}
	set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
	get className() { return [...this.classList.set].join(" "); }
	set innerHTML(v) { this._innerHTML = v; }
	get innerHTML() { return this._innerHTML; }
	setAttribute(k, v) { this.attrs[k] = String(v); }
	getAttribute(k) { return this.attrs[k] ?? null; }
	addEventListener(type, fn) { this.listeners.push({ type, fn }); }
	click() {
		this.listeners.filter(l => l.type === "click")
			.forEach(l => l.fn({ preventDefault() {}, stopPropagation() {} }));
	}
	appendChild(node) { node.parent = this; this.children.push(node); return node; }
	insertBefore(node, ref) {
		node.parent = this;
		const i = this.children.indexOf(ref);
		if (i < 0) this.children.push(node); else this.children.splice(i, 0, node);
		return node;
	}
	_matches(sel) {
		const m = sel.match(/^([a-zA-Z]+)?(?:\.(.+))?$/);
		const tag = m?.[1] ? m[1].toUpperCase() : null;
		const cls = m?.[2] || null;
		if (tag && this.tagName !== tag) return false;
		if (cls && !this.classList.contains(cls)) return false;
		return true;
	}
	querySelector(sel) {
		for (const c of this.children) {
			if (c._matches?.(sel)) return c;
			const d = c.querySelector?.(sel);
			if (d) return d;
		}
		return null;
	}
}

let shareLevelFor, addJournalShareButton, ShareJournalDialog;
let rendered;

beforeAll(async () => {
	global.document = { createElement: tag => new FakeEl(tag) };
	global.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OBSERVER: 2, OWNER: 3 } };
	global.JournalEntry = class {};
	global.ui = { notifications: { info() {}, error() {} } };
	rendered = [];
	global.Application = class {
		constructor(options) { this.options = options; }
		render() { rendered.push(this); return this; }
	};
	global.game = { user: { isGM: true } };
	({ shareLevelFor, addJournalShareButton, ShareJournalDialog } =
		await import("../../module/journal/share-journal.js"));
});

beforeEach(() => {
	global.game.user.isGM = true;
	rendered.length = 0;
});

// Build a fake journal-entry sheet: a window header (with a native close button to
// insert before) whose `app.document` is an `instanceof JournalEntry`.
function makeApp({ doc = "journal", ownershipDefault = 0 } = {}) {
	const header = new FakeEl("header");
	header.className = "window-header";
	const close = new FakeEl("button");
	close.className = "header-control";
	close.setAttribute("data-action", "close");
	header.appendChild(close);

	const root = new FakeEl("div");
	root.appendChild(header);

	let document;
	if (doc === "journal") {
		document = Object.assign(new JournalEntry(), {
			name: "The Forge",
			ownership: { default: ownershipDefault },
			update: async () => {},
		});
	} else {
		document = doc;
	}
	return { app: { element: root, document }, header };
}

describe("shareLevelFor", () => {
	it("returns NONE when players can't see the journal", () => {
		expect(shareLevelFor(false, false)).toBe(0);
		expect(shareLevelFor(false, true)).toBe(0); // not-visible wins over the upgrade
	});
	it("returns OBSERVER for read-only sharing", () => {
		expect(shareLevelFor(true, false)).toBe(2);
	});
	it("returns OWNER when the upgrade is ticked", () => {
		expect(shareLevelFor(true, true)).toBe(3);
	});
});

describe("addJournalShareButton", () => {
	it("does nothing for a non-GM", () => {
		global.game.user.isGM = false;
		const { app, header } = makeApp();
		addJournalShareButton(app);
		expect(header.querySelector(".stonetop-share-journal")).toBeNull();
	});

	it("does nothing when the sheet isn't a JournalEntry", () => {
		const { app, header } = makeApp({ doc: { name: "a page" } });
		addJournalShareButton(app);
		expect(header.querySelector(".stonetop-share-journal")).toBeNull();
	});

	it("adds an eye-slash button before the close control when hidden", () => {
		const { app, header } = makeApp({ ownershipDefault: 0 });
		addJournalShareButton(app);
		const btn = header.querySelector(".stonetop-share-journal");
		expect(btn).not.toBeNull();
		expect(btn.classList.contains("fa-eye-slash")).toBe(true);
		expect(btn.classList.contains("is-shared")).toBe(false);
		expect(btn.getAttribute("data-tooltip")).toMatch(/hidden/i);
		// Sits leftmost of the controls — before the native close button.
		expect(header.children[0]).toBe(btn);
	});

	it("shows a shared eye button when players already have access", () => {
		const { app, header } = makeApp({ ownershipDefault: 2 });
		addJournalShareButton(app);
		const btn = header.querySelector(".stonetop-share-journal");
		expect(btn.classList.contains("fa-eye")).toBe(true);
		expect(btn.classList.contains("is-shared")).toBe(true);
	});

	it("is idempotent and refreshes state on re-render", () => {
		const { app, header } = makeApp({ ownershipDefault: 0 });
		addJournalShareButton(app);
		// Player access granted elsewhere, then the sheet re-renders.
		app.document.ownership.default = 2;
		addJournalShareButton(app);
		const buttons = header.children.filter(c => c.classList.contains("stonetop-share-journal"));
		expect(buttons).toHaveLength(1);
		expect(buttons[0].classList.contains("is-shared")).toBe(true);
		expect(buttons[0].classList.contains("fa-eye")).toBe(true);
	});

	it("opens the share dialog for the journal when clicked", () => {
		const { app, header } = makeApp();
		addJournalShareButton(app);
		header.querySelector(".stonetop-share-journal").click();
		expect(rendered).toHaveLength(1);
		expect(rendered[0]).toBeInstanceOf(ShareJournalDialog);
		expect(rendered[0].journal).toBe(app.document);
	});
});
