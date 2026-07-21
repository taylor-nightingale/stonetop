import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundrySteadingRepository } from "../../../../src/actors/character/repositories/FoundrySteadingRepository.js";
import { StonetopSteading } from "../../../../src/actors/steading/StonetopSteading.js";
import { FakeGameBuilder } from "../../../fakes/FakeGameBuilder.js";

afterEach(() => vi.unstubAllGlobals());

// The repository hands back the typed actor, so what the character side reads (name, prosperity,
// isLacking, resolveBonus) is the same StonetopSteading the steading sheet rolls with — the display
// can't drift from the schema without the rolls drifting too.
function makeSteading({ name = "Stonetop", prosperity = 0, fortunes = 0, lacking = false, system } = {}) {
	const doc = {
		type: "steading",
		name,
		system: system ?? { attributes: { prosperity, fortunes }, debilities: { lacking } },
	};
	doc.typedActor = new StonetopSteading(doc);
	return doc;
}

const primary = () => new FoundrySteadingRepository().getPrimary();

describe("FoundrySteadingRepository.getPrimary", () => {
	it("returns null when there is no game", () => {
		expect(primary()).toBeNull();
	});

	it("returns null when the world has no steading actor", () => {
		new FakeGameBuilder().build();
		expect(primary()).toBeNull();
	});

	it("ignores non-steading actors", () => {
		new FakeGameBuilder().withWorldActor({ type: "character", name: "Rhianne" }).build();
		expect(primary()).toBeNull();
	});

	it("returns the typed actor, not the document", () => {
		new FakeGameBuilder().withWorldActor(makeSteading()).build();
		expect(primary()).toBeInstanceOf(StonetopSteading);
	});
});

// -- what the character side asks the returned steading -------------------------

describe("FoundrySteadingRepository — reads off the primary steading", () => {
	it("reports the stored prosperity rating as the roll bonus", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ prosperity: 1 })).build();
		expect(primary().prosperity).toBe(1);
	});

	it("carries a negative rating through", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ prosperity: -1 })).build();
		expect(primary().prosperity).toBe(-1);
	});

	it("defaults prosperity to 0 when the steading has no attributes yet", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ name: "Marshedge", system: {} })).build();
		expect(primary().prosperity).toBe(0);
		expect(primary().name).toBe("Marshedge");
	});

	it("carries the lacking debility", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ lacking: true })).build();
		expect(primary().isLacking).toBe(true);
	});

	it("does not treat a non-boolean lacking value as active (legacy data shapes)", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ lacking: { value: true } })).build();
		expect(primary().isLacking).toBe(false);
	});

	it("resolves fortunes for a character rolling Requisition", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ fortunes: 2 })).build();
		expect(primary().resolveBonus("fortunes")).toBe(2);
	});
});

// -- steading selection with strays ---------------------------------------------

describe("FoundrySteadingRepository steading selection", () => {
	it("prefers the steading named Stonetop over an earlier stray", () => {
		new FakeGameBuilder()
			.withWorldActor(makeSteading({ name: "New Steading", prosperity: -1, lacking: true }))
			.withWorldActor(makeSteading({ name: "Stonetop", prosperity: 1 }))
			.build();
		const steading = primary();
		expect(steading.name).toBe("Stonetop");
		expect(steading.prosperity).toBe(1);
		expect(steading.isLacking).toBe(false);
	});

	it("name match is case-insensitive and trims whitespace", () => {
		new FakeGameBuilder()
			.withWorldActor(makeSteading({ name: "New Steading" }))
			.withWorldActor(makeSteading({ name: " stonetop ", prosperity: 2 }))
			.build();
		expect(primary().prosperity).toBe(2);
	});

	it("prefers a renamed steading over one still at the default name", () => {
		new FakeGameBuilder()
			.withTranslation("TYPES.Actor.steading", "Steading")
			.withWorldActor(makeSteading({ name: "Steading" }))
			.withWorldActor(makeSteading({ name: "Marshedge", prosperity: -1 }))
			.build();
		const steading = primary();
		expect(steading.name).toBe("Marshedge");
		expect(steading.prosperity).toBe(-1);
	});

	it("treats the \"(2)\" duplicate suffix core appends as a default name too", () => {
		new FakeGameBuilder()
			.withTranslation("TYPES.Actor.steading", "Steading")
			.withWorldActor(makeSteading({ name: "Steading (2)" }))
			.withWorldActor(makeSteading({ name: "Marshedge", prosperity: -1 }))
			.build();
		expect(primary().name).toBe("Marshedge");
	});

	it("does not mistake a steading merely starting with the type label for a default name", () => {
		new FakeGameBuilder()
			.withTranslation("TYPES.Actor.steading", "Steading")
			.withWorldActor(makeSteading({ name: "Steading Hollow", prosperity: 4 }))
			.withWorldActor(makeSteading({ name: "Marshedge", prosperity: -1 }))
			.build();
		expect(primary().name).toBe("Steading Hollow");
	});

	it("falls back to the first steading when all are default-named", () => {
		new FakeGameBuilder()
			.withTranslation("TYPES.Actor.steading", "Steading")
			.withWorldActor(makeSteading({ name: "Steading", prosperity: 3 }))
			.withWorldActor(makeSteading({ name: "Steading (2)", prosperity: 0 }))
			.build();
		expect(primary().prosperity).toBe(3);
	});

	it("a single steading is used whatever its name", () => {
		new FakeGameBuilder().withWorldActor(makeSteading({ name: "Steading", prosperity: 2 })).build();
		expect(primary().name).toBe("Steading");
	});
});
