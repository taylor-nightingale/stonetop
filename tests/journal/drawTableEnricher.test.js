// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawTableElement, drawTableInlineElement, onClickDrawTable, registerDrawTableEnricher } from "../../src/journal/drawTableEnricher.js";

const UUID = "Compendium.stonetop.wonder-tables.RollTable.AbCdEfGhIjKlMnOp";
const match = (uuid = UUID, label = "1d12") => [`@DrawTable[${uuid}]{${label}}`, uuid, label];
const inlineMatch = (uuid = UUID, label = "1d6") => [`@DrawTableInline[${uuid}]{${label}}`, uuid, label];

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

describe("drawTableInlineElement", () => {
	afterEach(() => vi.unstubAllGlobals());

	const stubTable = (results) => vi.stubGlobal("fromUuid", async (uuid) => uuid === UUID ? { results } : null);

	it("renders a figure with the roll button and a row per result", async () => {
		stubTable([
			{ range: [1, 1], description: "Actively unpleasant" },
			{ range: [2, 3], description: "Bland but tolerable" },
		]);
		const fig = await drawTableInlineElement(inlineMatch());
		expect(fig.tagName).toBe("FIGURE");
		expect(fig.classList.contains("stonetop-inline-table")).toBe(true);
		// the roll button lives in the caption and still carries the uuid (so the click handler fires)
		const btn = fig.querySelector("figcaption a.stonetop-draw-table");
		expect(btn?.dataset.uuid).toBe(UUID);
		expect(btn.textContent).toContain("1d6");
		const rows = fig.querySelectorAll("table tbody tr");
		expect(rows).toHaveLength(2);
		expect(rows[0].querySelector("td.roll").textContent).toBe("1");       // single value
		expect(rows[1].querySelector("td.roll").textContent).toBe("2–3");     // range
		expect(rows[1].textContent).toContain("Bland but tolerable");
	});

	it("reads a result's text from .text or .name when .description is absent", async () => {
		stubTable([{ range: [1, 1], text: "from text" }, { range: [2, 2], name: "from name" }]);
		const fig = await drawTableInlineElement(inlineMatch());
		const rows = fig.querySelectorAll("table tbody tr");
		expect(rows[0].textContent).toContain("from text");
		expect(rows[1].textContent).toContain("from name");
	});

	it("falls back to a bare roll button when the table can't be read", async () => {
		vi.stubGlobal("fromUuid", async () => null); // pack unreadable / not built
		const el = await drawTableInlineElement(inlineMatch());
		expect(el.tagName).toBe("A");
		expect(el.classList.contains("stonetop-draw-table")).toBe(true);
		expect(el.dataset.uuid).toBe(UUID);
	});
});

describe("onClickDrawTable", () => {
	let drawn, warned;
	beforeEach(() => {
		drawn = [];
		warned = [];
		vi.stubGlobal("ui", { notifications: { warn: (m) => warned.push(m) } });
		vi.stubGlobal("fromUuid", async (uuid) => uuid === UUID ? { draw: () => { drawn.push(uuid); } } : null);
	});
	afterEach(() => vi.unstubAllGlobals());

	// A click event whose target sits inside a draw button.
	const clickInside = () => {
		const a = drawTableElement(match());
		document.body.appendChild(a);
		return { target: a, preventDefault: () => {} };
	};

	it("draws from the referenced table for a GM", async () => {
		vi.stubGlobal("game", { user: { isGM: true } });
		await onClickDrawTable(clickInside());
		expect(drawn).toEqual([UUID]);
		expect(warned).toEqual([]);
	});

	it("draws for a non-GM too (players can roll their own arcana tables)", async () => {
		vi.stubGlobal("game", { user: { isGM: false } });
		await onClickDrawTable(clickInside());
		expect(drawn).toEqual([UUID]);
		expect(warned).toEqual([]);
	});

	it("ignores clicks that are not on a draw button", async () => {
		vi.stubGlobal("game", { user: { isGM: true } });
		const span = document.createElement("span");
		document.body.appendChild(span);
		await onClickDrawTable({ target: span });
		expect(drawn).toEqual([]);
	});

	it("warns when the table uuid does not resolve", async () => {
		vi.stubGlobal("game", { user: { isGM: true } });
		const a = drawTableElement(match("Compendium.stonetop.wonder-tables.RollTable.missing000000000"));
		document.body.appendChild(a);
		await onClickDrawTable({ target: a, preventDefault: () => {} });
		expect(drawn).toEqual([]);
		expect(warned).toHaveLength(1);
	});
});

describe("registerDrawTableEnricher", () => {
	beforeEach(() => { vi.stubGlobal("CONFIG", {}); });
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

	it("registers a separate inline enricher whose pattern matches @DrawTableInline (not @DrawTable)", () => {
		registerDrawTableEnricher();
		const cfg = CONFIG.TextEditor.enrichers.find((e) => e.id === "stonetop-draw-table-inline");
		expect(cfg).toBeTruthy();
		expect([...`@DrawTableInline[${UUID}]{1d6}`.matchAll(cfg.pattern)]).toHaveLength(1);
		// the button-only pattern must NOT match the inline token (no double render)
		const plain = CONFIG.TextEditor.enrichers.find((e) => e.id === "stonetop-draw-table");
		expect([...`@DrawTableInline[${UUID}]{1d6}`.matchAll(plain.pattern)]).toHaveLength(0);
	});
});
