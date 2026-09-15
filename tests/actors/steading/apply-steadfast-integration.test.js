import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { applySteadfast, seedSteadfast } from "../../../src/actors/steading/applySteadfast.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingSnapshot } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// End-to-end (real code, mock only Foundry): apply the REAL Stonetop steadfast to a blank steading,
// then drive the real snapshot + rolling. Catches wiring bugs that per-class unit tests (with
// hand-built mocks) miss — e.g. applySteadfast writing a field the snapshot reads under another name.
const stonetop = JSON.parse(readFileSync(new URL("../../../packs/src/steadfasts/stonetop.json", import.meta.url)));

function blankSteading(name = "Test Actor") {
	return new FakeActorBuilder().withType("steading").withName(name).withSystem({
		steadfast: "",
		notes: "", rollMode: "normal",
		debilities: { diminished: false, lacking: false, malcontent: false },
		content: { excluded: [], veiled: [], specialHandling: [] },
		attributes: { fortunes: 0, surplus: 0, size: "", population: 0, prosperity: 0, defenses: 0 },
		assets: { items: [], resources: [], fortifications: [], coinage: [] },
		placesOfInterest: [], neighborPlaces: [],
		residents: { names: "", traits: [] },
		residentPeople: [], neighborPeople: [],
		improvements: [], improvementValues: {},
	}).build();
}

const movesRepo = new FakeMoveRepository();
const improvementsRepo = { getBySlug: async () => null };

describe("seed a newly created steading from the real Stonetop steadfast (integration)", () => {
	it("keeps the created name while taking Stonetop's starting values", async () => {
		const actor = blankSteading("Havenrock");
		await seedSteadfast(actor, stonetop);
		expect(actor.name).toBe("Havenrock");
		expect(actor.system.steadfast).toBe("stonetop");
		expect(actor.system.improvements).toHaveLength(17);
		expect(actor.system.attributes).toEqual(stonetop.system.attributes);
		expect(actor.system.startingAttributes).toEqual(stonetop.system.attributes);
	});

	it("renders the same snapshot an applied steadfast does, under the created name", async () => {
		const actor = blankSteading("Havenrock");
		await seedSteadfast(actor, stonetop);
		const snap = await new StonetopSteading(actor, steadingRepos({ improvements: improvementsRepo, moves: movesRepo })).buildSnapshot();

		expect(snap.attributes.size.current).toBe("village");
		expect(snap.fortunes.current).toBe(1);
		expect(snap.surplus.current).toBe(1);
		expect(snap.placesOfInterest).toHaveLength(6);
	});
});

describe("apply Stonetop steadfast → steading (integration)", () => {
	it("records the steadfast and copies its owned improvements (all 17 core)", async () => {
		const actor = blankSteading();
		await applySteadfast(actor, stonetop);
		expect(actor.system.steadfast).toBe("stonetop");
		expect(actor.system.improvements).toHaveLength(17);
		expect(actor.system.improvements).toContain("market");
	});

	it("renders a snapshot at Stonetop's starting values", async () => {
		const actor = blankSteading();
		await applySteadfast(actor, stonetop);
		const snap = await new StonetopSteading(actor, steadingRepos({ improvements: improvementsRepo, moves: movesRepo })).buildSnapshot();

		expect(snap).toBeInstanceOf(SteadingSnapshot);
		// Size is the village tier; its option is the one selected.
		expect(snap.attributes.size.current).toBe("village");
		expect(snap.attributes.size.options.find(o => o.value === "village").selected).toBe(true);
		expect(snap.attributes.size.isNumeric).toBe(false);
		// Ratings are actual numbers; Prosperity/Defenses carry their backing lists from assets.
		expect(snap.attributes.prosperity.current).toBe(0);
		expect(snap.attributes.prosperity.items).toHaveLength(8);
		expect(snap.attributes.defenses.items).toHaveLength(4);
		// Fortunes +1, surplus 1.
		expect(snap.fortunes.current).toBe(1);
		expect(snap.surplus.current).toBe(1);
		// Places (6) and the resident pool came across.
		expect(snap.placesOfInterest).toHaveLength(6);
		expect(snap.placesOfInterest[0].value).toBe("The Stone");
		// Both pools arrive as clickable entries in the Folk tab's reference column — the names under
		// the place they come from, the traits as the list's last block.
		expect(snap.folkSuggestions[0].entries.map(e => e.label)).toContain("Aderyn");
		expect(snap.folkSuggestions.at(-1).entries.length).toBeGreaterThanOrEqual(90);
		// Nothing has moved off the baseline yet, so no rating claims a history it doesn't have.
		expect(snap.fortunes.startingNote).toBe("");
		expect(snap.attributes.size.startingNote).toBe("");
		expect(snap.attributes.prosperity.startingNote).toBe("");
	});

	it("notes where a rating started once it has moved off that baseline", async () => {
		const actor = blankSteading();
		await applySteadfast(actor, stonetop);
		const steading = new StonetopSteading(actor, steadingRepos({ improvements: improvementsRepo, moves: movesRepo }));

		await steading.setFortunes(3);
		await steading.setAttribute("prosperity", 2);

		const snap = await steading.buildSnapshot();
		expect(snap.fortunes.startingNote).toBe("was +1");
		expect(snap.attributes.prosperity.startingNote).toBe("was +0");
		// Untouched ratings still say nothing.
		expect(snap.attributes.defenses.startingNote).toBe("");
	});

	it("shows no starting notes on a blank steading (no steadfast applied)", async () => {
		const snap = await new StonetopSteading(blankSteading(), steadingRepos({ improvements: improvementsRepo, moves: movesRepo })).buildSnapshot();
		expect(snap.fortunes.startingNote).toBe("");
		expect(snap.surplus.startingNote).toBe("");
		expect(snap.attributes.size.startingNote).toBe("");
		expect(snap.attributes.prosperity.startingNote).toBe("");
	});

	it("rolls the actual rating values", async () => {
		const actor = blankSteading();
		await applySteadfast(actor, stonetop);
		const steading = new StonetopSteading(actor, steadingRepos({ improvements: improvementsRepo, moves: movesRepo }));
		expect(steading.resolveBonus("prosperity")).toBe(0);
		expect(steading.resolveBonus("fortunes")).toBe(1);
		expect(steading.resolveBonus("surplus")).toBe(1);
	});
});
