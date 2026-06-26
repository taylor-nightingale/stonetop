import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawTableElement, onClickDrawTable, registerDrawTableEnricher } from "../../module/journal/drawTableEnricher.js";

// The module is DOM/Foundry wiring; the behavior worth guarding is the GM-gate + the token pattern.
// The test env is node (no DOM), so fake just the element surface the enricher touches, mirroring
// tests/journal/restrict-content-links.test.js.

function makeEl(tag) {
	const el = {
		tagName: String(tag).toUpperCase(),
		_classes: new Set(),
		dataset: {},
		className: "",
		children: [],
		_text: "",
		classList: { add: (...c) => c.forEach((x) => el._classes.add(x)), contains: (c) => el._classes.has(c) },
		append: (...nodes) => { for (const n of nodes) typeof n === "string" ? (el._text += n) : el.children.push(n); },
		get textContent() { return el._text + el.children.map((c) => c.textContent).join(""); },
		querySelector: (sel) => {
			const [t, cls] = sel.split(".");
			return el.children.find((c) =>
				(!t || c.tagName === t.toUpperCase()) && (!cls || String(c.className).split(/\s+/).includes(cls))) ?? null;
		},
		closest: (sel) => {
			const [t, cls] = sel.split(".");
			const match = (!t || el.tagName === t.toUpperCase())
				&& (!cls || el._classes.has(cls) || String(el.className).split(/\s+/).includes(cls));
			return match ? el : null;
		},
	};
	return el;
}

// node has no document; provide the tiny surface the enricher uses (persists across vi.unstubAllGlobals).
globalThis.document = { createElement: makeEl, addEventListener: () => {} };

const UUID = "Compendium.stonetop.wonder-tables.RollTable.AbCdEfGhIjKlMnOp";
const match = (uuid = UUID, label = "1d12") => [`@DrawTable[${uuid}]{${label}}`, uuid, label];

describe("drawTableElement", () => {
	it("builds an anchor with the dice icon, formula, and table uuid", () => {
		const a = drawTableElement(match());
		expect(a.tagName).toBe("A");
		expect(a.classList.contains("stonetop-draw-table")).toBe(true);
		expect(a.dataset.uuid).toBe(UUID);
		expect(a.querySelector("i.fa-dice-d6")).toBeTruthy(); // FoundryVTT dice icon
		expect(a.textContent).toContain("1d12");
	});
});

describe("onClickDrawTable", () => {
	let drawn, warned;
	beforeEach(() => {
		drawn = [];
		warned = [];
		vi.stubGlobal("ui", { notifications: { warn: (m) => warned.push(m) } });
		vi.stubGlobal("fromUuid", async (uuid) => (uuid === UUID ? { draw: () => { drawn.push(uuid); } } : null));
	});
	afterEach(() => vi.unstubAllGlobals());

	const clickInside = () => ({ target: drawTableElement(match()), preventDefault: () => {} });

	it("draws from the referenced table for a GM", async () => {
		vi.stubGlobal("game", { user: { isGM: true } });
		await onClickDrawTable(clickInside());
		expect(drawn).toEqual([UUID]);
		expect(warned).toEqual([]);
	});

	it("does nothing and warns for a non-GM", async () => {
		vi.stubGlobal("game", { user: { isGM: false } });
		await onClickDrawTable(clickInside());
		expect(drawn).toEqual([]);
		expect(warned).toHaveLength(1);
	});

	it("ignores clicks that are not on a draw button", async () => {
		vi.stubGlobal("game", { user: { isGM: true } });
		await onClickDrawTable({ target: makeEl("span") });
		expect(drawn).toEqual([]);
	});

	it("warns when the table uuid does not resolve", async () => {
		vi.stubGlobal("game", { user: { isGM: true } });
		const target = drawTableElement(match("Compendium.stonetop.wonder-tables.RollTable.missing000000000"));
		await onClickDrawTable({ target, preventDefault: () => {} });
		expect(drawn).toEqual([]);
		expect(warned).toHaveLength(1);
	});
});

describe("registerDrawTableEnricher", () => {
	beforeEach(() => vi.stubGlobal("CONFIG", {}));
	afterEach(() => vi.unstubAllGlobals());

	it("registers an enricher whose pattern matches a @DrawTable token", () => {
		registerDrawTableEnricher();
		const cfg = CONFIG.TextEditor.enrichers.find((e) => e.id === "stonetop-draw-table");
		expect(cfg).toBeTruthy();
		// Foundry feeds the enricher each full match WITH capture groups (via matchAll/exec).
		const m = [...`@DrawTable[${UUID}]{🎲 Draw}`.matchAll(cfg.pattern)][0];
		expect(m).toBeTruthy();
		const el = cfg.enricher(m);
		expect(el.dataset.uuid).toBe(UUID);
	});
});
