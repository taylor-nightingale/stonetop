// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawTableElement, onClickDrawTable, registerDrawTableEnricher } from "../../src/journal/drawTableEnricher.js";

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

	it("does nothing and warns for a non-GM", async () => {
		vi.stubGlobal("game", { user: { isGM: false } });
		await onClickDrawTable(clickInside());
		expect(drawn).toEqual([]);
		expect(warned).toHaveLength(1);
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
});
