import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { applySteadfast } from "../../../src/actors/steading/applySteadfast.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingSnapshot } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";

// End-to-end (real code, mock only Foundry): apply the REAL Stonetop steadfast to a blank steading,
// then drive the real snapshot + rolling. Catches wiring bugs that per-class unit tests (with
// hand-built mocks) miss — e.g. applySteadfast writing a field the snapshot reads under another name.
const stonetop = JSON.parse(readFileSync(new URL("../../../packs/src/steadfasts/stonetop.json", import.meta.url)));

function blankSteading() {
	return new FakeActorBuilder().withType("steading").withSystem({
		steadfast: "",
		notes: "", rollMode: "normal",
		debilities: { diminished: false, lacking: false, malcontent: false },
		content: { excluded: [], veiled: [], specialHandling: [], excludedText: "", veiledText: "", specialHandlingText: "" },
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
		const snap = await new StonetopSteading(actor, improvementsRepo, movesRepo).buildSnapshot();

		expect(snap).toBeInstanceOf(SteadingSnapshot);
		// Size is the village tier; its option is the one selected.
		expect(snap.attributes.size.current).toBe("village");
		expect(snap.attributes.size.options.find(o => o.value === "village").selected).toBe(true);
		// Ratings are actual numbers; Prosperity/Defenses carry their backing lists from assets.
		expect(snap.attributes.prosperity.current).toBe(0);
		expect(snap.attributes.prosperity.items).toHaveLength(8);
		expect(snap.attributes.defenses.items).toHaveLength(4);
		// Fortunes +1, surplus 1.
		expect(snap.fortunes.current).toBe(1);
		expect(snap.fortunes.options.find(o => o.value === 1).selected).toBe(true);
		expect(snap.surplus.current).toBe(1);
		// Places (6) and the resident pool came across.
		expect(snap.placesOfInterest).toHaveLength(6);
		expect(snap.placesOfInterest[0].value).toBe("The Stone");
		expect(snap.residentNames).toContain("Aderyn");
		expect(snap.residentTraits.length).toBeGreaterThanOrEqual(90);
		// The "Starts at …" notes are derived from the starting baseline + localized template.
		expect(snap.fortunes.note.raw).toBe("Starts at +1");
		expect(snap.attributes.size.note.raw).toBe("Starts at <em>village</em>");
		expect(snap.attributes.prosperity.note.raw).toBe("Starts at +0");
	});

	it("shows no 'Starts at …' notes on a blank steading (no steadfast applied)", async () => {
		const snap = await new StonetopSteading(blankSteading(), improvementsRepo, movesRepo).buildSnapshot();
		expect(snap.fortunes.note.raw).toBe("");
		expect(snap.surplus.note.raw).toBe("");
		expect(snap.attributes.size.note.raw).toBe("");
		expect(snap.attributes.prosperity.note.raw).toBe("");
	});

	it("rolls the actual rating values", async () => {
		const actor = blankSteading();
		await applySteadfast(actor, stonetop);
		const steading = new StonetopSteading(actor, improvementsRepo, movesRepo);
		expect(steading.resolveBonus("prosperity")).toBe(0);
		expect(steading.resolveBonus("fortunes")).toBe(1);
		expect(steading.resolveBonus("surplus")).toBe(1);
	});
});
