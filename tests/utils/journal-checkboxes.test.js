import { describe, expect, it, vi, beforeAll } from "vitest";
import { applyJournalCheckboxes } from "../../module/utils/journal-checkboxes.js";

// The module is DOM/Foundry wiring, but the parts worth guarding — per-page
// keying, the read-only-vs-editable branch, and what gets persisted on toggle —
// are simple. The test env is node (no DOM), so fake just what the function
// touches, mirroring tests/utils/question-bullets.test.js.

class FakeClassList {
	#set = new Set();
	add(...names) { names.forEach((n) => this.#set.add(n)); }
	remove(...names) { names.forEach((n) => this.#set.delete(n)); }
	contains(name) { return this.#set.has(name); }
	toggle(name, force) {
		const on = force ?? !this.#set.has(name);
		if (on) this.#set.add(name); else this.#set.delete(name);
		return on;
	}
	get value() { return [...this.#set]; }
}

class FakeEl {
	constructor(tag = "div") {
		this.tagName = tag.toUpperCase();
		this.classList = new FakeClassList();
		this.dataset = {};
		this.attrs = {};
		this.children = [];
		this.listeners = {};
		this.parentLi = null;
	}
	set className(v) { String(v).split(/\s+/).forEach((c) => c && this.classList.add(c)); }
	setAttribute(k, v) { this.attrs[k] = String(v); }
	getAttribute(k) { return this.attrs[k] ?? null; }
	addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
	fire(type, ev = {}) {
		(this.listeners[type] ?? []).forEach((fn) =>
			fn({ preventDefault() {}, stopPropagation() {}, ...ev }));
	}
	prepend(child) { this.children.unshift(child); child.parentLi = this; }
	querySelector(sel) {
		return sel.includes("stonetop-journal-check")
			? this.children.find((c) => c.classList.contains("stonetop-journal-check")) ?? null
			: null;
	}
	closest(sel) { return sel === "li" ? (this.tagName === "LI" ? this : this.parentLi) : null; }
	get control() { return this.querySelector(".stonetop-journal-check"); }
}

beforeAll(() => {
	global.document = { createElement: (tag) => new FakeEl(tag) };
	global.game = { ...(global.game ?? {}), user: { id: "u1" } };
});

function makePage({ checks = {}, editable = true, inCompendium = false, pack } = {}) {
	const flags = { stonetop: { checks: { ...checks } } };
	// A Stonetop journal is recognised either by its compendium `pack` (the immutable
	// compendium copy) or, for a world copy, by Foundry's import stamp (no pack). Only
	// the compendium copy is read-only; the world copy is what players actually tick.
	let parent;
	if (pack !== undefined) parent = { pack };                                  // explicit (e.g. a non-Stonetop pack)
	else if (inCompendium) parent = { pack: "stonetop.stonetop-journal" };  // immutable compendium copy
	else parent = { pack: null, _stats: { compendiumSource: "Compendium.stonetop.stonetop-journal.JournalEntry.abc" } };
	return {
		documentName: "JournalEntryPage",
		id: "page1",
		parent,
		flags,
		getFlag: (scope, key) => flags[scope]?.[key],
		canUserModify: () => editable,
		update: vi.fn((data) => {
			for (const [path, val] of Object.entries(data)) {
				const m = path.match(/^flags\.stonetop\.checks\.(-=)?(.+)$/);
				if (!m) continue;
				// Accept either delete form: v12's `-=key`/null or v13+'s ForcedDeletion sentinel.
				if (m[1] || val === foundry.data?.operators?.ForcedDeletion) delete flags.stonetop.checks[m[2]];
				else flags.stonetop.checks[m[2]] = val;
			}
			return Promise.resolve();
		}),
	};
}

function run(page, count) {
	const lis = Array.from({ length: count }, () => {
		const li = new FakeEl("li");
		li.classList.add("check-bullet");
		return li;
	});
	const root = { querySelectorAll: () => lis };
	applyJournalCheckboxes({ document: page }, root);
	return lis;
}

describe("applyJournalCheckboxes", () => {
	it("injects a keyed, focusable control per check item when the page is editable", () => {
		const page = makePage();
		const [a, b] = run(page, 2);

		expect(a.control.getAttribute("role")).toBe("checkbox");
		expect(a.control.getAttribute("tabindex")).toBe("0");
		expect(a.control.dataset.checkKey).toBe("c0");
		expect(b.control.dataset.checkKey).toBe("c1");
		expect(a.classList.contains("stonetop-check-interactive")).toBe(true);
		expect(a.control.getAttribute("aria-checked")).toBe("false");
	});

	it("reflects the stored state and persists a toggle on click", () => {
		const page = makePage({ checks: { c1: true } });
		const [a, b] = run(page, 2);

		// c1 starts checked from the flag; c0 starts unchecked.
		expect(b.control.getAttribute("aria-checked")).toBe("true");
		expect(b.classList.contains("checked")).toBe(true);
		expect(a.control.getAttribute("aria-checked")).toBe("false");

		a.control.fire("click");
		expect(page.update).toHaveBeenCalledWith({ "flags.stonetop.checks.c0": true });
		expect(a.control.getAttribute("aria-checked")).toBe("true");
		expect(a.classList.contains("checked")).toBe(true);

		b.control.fire("click");
		expect(page.update).toHaveBeenCalledWith({ "flags.stonetop.checks.c1": foundry.data.operators.ForcedDeletion });
		expect(b.control.getAttribute("aria-checked")).toBe("false");
	});

	it("unchecks via the legacy `-=` syntax when ForcedDeletion is unavailable (v12)", () => {
		const operators = foundry.data.operators;
		foundry.data.operators = undefined; // simulate a v12 core
		try {
			const page = makePage({ checks: { c0: true } });
			const [a] = run(page, 1);

			a.control.fire("click");
			expect(page.update).toHaveBeenCalledWith({ "flags.stonetop.checks.-=c0": null });
			expect(a.control.getAttribute("aria-checked")).toBe("false");
		} finally {
			foundry.data.operators = operators;
		}
	});

	it("toggles via keyboard (Space/Enter) only", () => {
		const page = makePage();
		const [a] = run(page, 1);

		a.control.fire("keydown", { key: "a" });
		expect(page.update).not.toHaveBeenCalled();

		a.control.fire("keydown", { key: " " });
		expect(page.update).toHaveBeenCalledWith({ "flags.stonetop.checks.c0": true });
	});

	it("shows checked state but injects no control when the user can't edit the page", () => {
		const page = makePage({ checks: { c0: true }, editable: false });
		const [a, b] = run(page, 2);

		expect(a.control).toBeNull();
		expect(b.control).toBeNull();
		expect(a.classList.contains("checked")).toBe(true);
		expect(b.classList.contains("checked")).toBe(false);
	});

	it("shows checked state read-only on a compendium (immutable) page, even for a GM", () => {
		// editable:true == the user *could* modify it permission-wise, but it's the
		// compendium copy, so no editable control is injected (it would fail to persist).
		const page = makePage({ checks: { c0: true }, editable: true, inCompendium: true });
		const [a, b] = run(page, 2);

		expect(a.control).toBeNull();
		expect(b.control).toBeNull();
		expect(a.classList.contains("checked")).toBe(true);
		expect(b.classList.contains("checked")).toBe(false);
		expect(page.update).not.toHaveBeenCalled();
	});

	it("ignores journals outside the Stonetop pack", () => {
		const page = makePage({ pack: "some-other.pack" });
		const [a] = run(page, 1);

		expect(a.control).toBeNull();
		expect(a.classList.contains("stonetop-check-interactive")).toBe(false);
		expect(page.update).not.toHaveBeenCalled();
	});
});
