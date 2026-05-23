import { describe, it, expect, vi } from "vitest";
import { CharacterOrigin } from "../../../module/actors/character/CharacterOrigin.js";
import { OriginSection } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

// -- Helpers ------------------------------------------------------------------

function makeFlags(selected = "") {
	const store = { selected };
	return {
		getFlag: key => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeActor() {
	return { update: vi.fn() };
}

function makeOrigin(selected = "", actor = makeActor()) {
	return new CharacterOrigin(makeFlags(selected), actor);
}

const ORIGIN_DATA = [
	{ region: "Stonetop",     names: ["Brakken", "Arwel"] },
	{ region: "Barrier Pass", names: ["Durra", "Kael"] },
];

// -- buildSnapshot ------------------------------------------------------------

describe("CharacterOrigin.buildSnapshot", () => {
	it("returns an OriginSection", () => {
		expect(makeOrigin().buildSnapshot(ORIGIN_DATA)).toBeInstanceOf(OriginSection);
	});

	it("includes one option per entry in originData", () => {
		const snap = makeOrigin().buildSnapshot(ORIGIN_DATA);
		expect(snap.options).toHaveLength(2);
	});

	it("option has region and names", () => {
		const snap = makeOrigin().buildSnapshot(ORIGIN_DATA);
		expect(snap.options[0].region).toBe("Stonetop");
		expect(snap.options[0].names).toContain("Brakken");
	});

	it("option matching saved region is selected", () => {
		const snap = makeOrigin("Stonetop").buildSnapshot(ORIGIN_DATA);
		expect(snap.options[0].selected).toBe(true);
		expect(snap.options[1].selected).toBe(false);
	});

	it("no option is selected when nothing saved", () => {
		const snap = makeOrigin("").buildSnapshot(ORIGIN_DATA);
		expect(snap.options.every(o => !o.selected)).toBe(true);
	});

	it("selected is the saved region", () => {
		const snap = makeOrigin("Barrier Pass").buildSnapshot(ORIGIN_DATA);
		expect(snap.selected).toBe("Barrier Pass");
	});

	it("selected is null when nothing saved", () => {
		expect(makeOrigin("").buildSnapshot(ORIGIN_DATA).selected).toBeNull();
	});

	it("returns empty options when originData is absent", () => {
		expect(makeOrigin().buildSnapshot(undefined).options).toHaveLength(0);
	});

	it("returns empty options when originData is empty", () => {
		expect(makeOrigin().buildSnapshot([]).options).toHaveLength(0);
	});
});

// -- selectName ---------------------------------------------------------------

describe("CharacterOrigin.selectName", () => {
	it("calls actor.update with the given name", async () => {
		const actor = makeActor();
		const origin = makeOrigin("", actor);
		await origin.selectName("Arwel");
		expect(actor.update).toHaveBeenCalledWith({ name: "Arwel" });
	});
});
