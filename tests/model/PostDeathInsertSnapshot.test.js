import { describe, it, expect } from "vitest";
import { PostDeathInsertSnapshot, PostDeathInsertSnapshotBuilder } from "../../module/model/snapshot/character/PostDeathInsertSnapshot.js";
import { ChoiceOption, ChoiceRow, HeadingRow, ChoiceGroup } from "../../module/model/snapshot/character/ChoiceGroup.js";

// -- Fixtures -----------------------------------------------------------------

const INSTINCT_SNAP = { group: new ChoiceGroup("instinct", []), selected: "Denial — To refuse to accept that you are dead." };

const LORE = [
	new ChoiceGroup("consequences", [
		new HeadingRow("Consequences", "<p>Choose 1...</p>"),
		new ChoiceRow([new ChoiceOption("breakdown", { description: "<p>You lash out...</p>", checks: [true], requires: null })]),
		new ChoiceRow([new ChoiceOption("unstable",  { description: "<p>You are prone...</p>", checks: [false], requires: "breakdown" })]),
	]),
];

const buildSnapshot = () =>
	new PostDeathInsertSnapshotBuilder()
		.withSlug("revenant")
		.withName("Revenant")
		.withImg("icons/svg/skull.png")
		.withDescription("<p>When you die...</p>")
		.withInstinct(INSTINCT_SNAP)
		.withMoves([])
		.withLore(LORE)
		.build();

// -- Tests --------------------------------------------------------------------

describe("PostDeathInsertSnapshot", () => {
	it("stores slug, name, img, description", () => {
		const snap = buildSnapshot();
		expect(snap.slug).toBe("revenant");
		expect(snap.name).toBe("Revenant");
		expect(snap.img).toBe("icons/svg/skull.png");
		expect(snap.description).toBe("<p>When you die...</p>");
	});

	it("stores instinct snapshot", () => {
		expect(buildSnapshot().instinct).toBe(INSTINCT_SNAP);
	});

	it("stores moves array", () => {
		expect(buildSnapshot().moves).toEqual([]);
	});

	it("stores lore", () => {
		expect(buildSnapshot().lore).toBe(LORE);
	});
});

describe("ChoiceOption requires", () => {
	it("stores requires when set", () => {
		expect(new ChoiceOption("unstable", { requires: "breakdown" }).requires).toBe("breakdown");
	});

	it("defaults requires to null when not set", () => {
		expect(new ChoiceOption("breakdown", { requires: null }).requires).toBeNull();
	});

	it("defaults requires to null when option omitted", () => {
		expect(new ChoiceOption("quarry").requires).toBeNull();
	});
});
