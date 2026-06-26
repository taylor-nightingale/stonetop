import { describe, it, expect } from "vitest";
import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	MinorArcanumSnapshot,
} from "../../../module/model/CharacterSnapshot.js";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeActorBuilder, FakeStatBuilder} from "../../fakes/FakeActorBuilder.js";

function makeCharacter(actor, arcanaRepo = null) {
	return new TestCharacterBuilder(actor).withArcanaRepo(arcanaRepo).build();
}

// -- Arcana fixtures ----------------------------------------------------------

const CARVINGS_IN_A_CAVE = {
	slug: "carvings-in-a-cave",
	front: {
		title: "Carvings in a Cave",
		item: null,
		description: "<p>Strange carvings.</p>",
		unlock: { description: "Unlock by…", requirements: [] },
	},
	back: {
		title: "Shell Game of Souls",
		item: null,
		description: "<p>You may contain souls.</p>",
		resource: { max: null, maxStat: "con", title: "Souls", labels: [] },
		move: null,
		options: [],
	},
};

const BOW_WITH_NO_STRING = {
	slug: "bow-with-no-string",
	front: {
		title: "A Bow with No String",
		item: { name: "A Bow with No String", weight: 1, note: null, inventoryColumn: "regular" },
		description: "<p>An ancient bow.</p>",
		unlock: { description: "Unlock by…", requirements: [] },
	},
	back: {
		title: "Thunderbolt Bow",
		item: {
			name: "Thunderbolt Bow",
			weight: 1,
			note: "<em>magical</em>",
			inventoryColumn: "regular",
			resource: { max: 3, maxStat: null, title: "Ammo", labels: ["plenty left", "low ammo", "all out"] },
		},
		description: "<p>A crackling bow of lightning.</p>",
		resource: null,
		move: null,
		options: [],
	},
};

const FFYRNIG_SPHERE = {
	slug: "huge-wooden-sphere",
	front: {
		title: "A Huge Wooden Sphere",
		item: { name: "A Huge Wooden Sphere", weight: null, note: "immobile", inventoryColumn: null },
		description: "<p>Half-buried and largely overgrown.</p>",
		unlock: {
			description: "The pictograms depict some sort of recipe, which you can learn but you must…",
			requirements: [
				{ type: "text",   content: "The pictograms depict some sort of recipe, which you can learn but you must…" },
				{ type: "option", slug: "dig-sphere",   description: "… first dig up and clean the sphere." },
				{ type: "option", slug: "study-glyphs", description: "… spend weeks studying the glyphs." },
				{ type: "text",   content: "And then…" },
				{ type: "option", slug: "risk-recipe",  description: "… risk getting the recipe wrong, and lethally so.", max: 3 },
			],
		},
	},
	back: {
		title: "Ffyrnig Tonic",
		item: { name: "Ffyrnig Tonic", weight: 1, note: "magical", inventoryColumn: "regular" },
		description: "<p>When you pickle fresh ffyrnig root in a suspension of boar bile for two full moons, it becomes a skin of ffyrnig tonic (3 uses, magical).</p>",
		resource: { max: 3, maxStat: null, title: "Ffyrnig Tonic", labels: [] },
		move: {
			name: "When you take a draught of ffyrnig tonic",
			rollType: null,
			description: "<p>pick 1:<br>Regain HP equal to ½ your max<br>Clear a debility</p>",
		},
		options: [],
	},
};

// -- Tests --------------------------------------------------------------------

describe("buildSnapshot() — arcana (integration)", () => {
	it("arcana is always present even with no owned items", async () => {
		const snap = await makeCharacter(new FakeActorBuilder().build()).buildSnapshot();
		expect(snap.arcana).toBeInstanceOf(ArcanaSnapshot);
	});

	it("arcana.minor and arcana.major are ArcanaSectionSnapshot instances", async () => {
		const snap = await makeCharacter(new FakeActorBuilder().build()).buildSnapshot();
		expect(snap.arcana.minor).toBeInstanceOf(ArcanaSectionSnapshot);
		expect(snap.arcana.major).toBeInstanceOf(ArcanaSectionSnapshot);
	});

	it("arcana.minor.items is [] when no owned slugs", async () => {
		const snap = await makeCharacter(new FakeActorBuilder().build()).buildSnapshot();
		expect(snap.arcana.minor.items).toEqual([]);
	});

	it("arcana.minor.title is 'Minor Arcana'", async () => {
		const snap = await makeCharacter(new FakeActorBuilder().build()).buildSnapshot();
		expect(snap.arcana.minor.title).toBe("Minor Arcana");
	});

	describe("with owned arcanum", () => {
		function buildWithFlags(arcanaFlags = {}) {
			const flatFlags = Object.fromEntries(
				Object.entries(arcanaFlags).map(([k, v]) => [`arcana.${k}`, v])
			);
			const actor = new FakeActorBuilder().withFlags(flatFlags).build();
			const char  = new TestCharacterBuilder(actor).addArcanum(FFYRNIG_SPHERE).build();
			return char.buildSnapshot();
		}

		it("owned slug appears in minor.items", async () => {
			const snap = await buildWithFlags({ owned: ["huge-wooden-sphere"] });
			expect(snap.arcana.minor.items).toHaveLength(1);
		});

		it("item in minor.items is a MinorArcanumSnapshot", async () => {
			const snap = await buildWithFlags({ owned: ["huge-wooden-sphere"] });
			expect(snap.arcana.minor.items[0]).toBeInstanceOf(MinorArcanumSnapshot);
		});

		it("owned is true", async () => {
			const snap = await buildWithFlags({ owned: ["huge-wooden-sphere"] });
			expect(snap.arcana.minor.items[0].owned).toBe(true);
		});

		it("flipped is true when in flipped flag", async () => {
			const snap = await buildWithFlags({
				owned:   ["huge-wooden-sphere"],
				flipped: ["huge-wooden-sphere"],
			});
			expect(snap.arcana.minor.items[0].flipped).toBe(true);
		});
	});

	describe("arcana resource reads from inventory flag", () => {
		it("back.resource.current reflects inventory.resources flag", async () => {
			const actor = new FakeActorBuilder()
				.withFlags({
					"arcana.owned":          ["huge-wooden-sphere"],
					"inventory.resources":   { "huge-wooden-sphere": 2 },
				})
				.build();
			const snap = await new TestCharacterBuilder(actor).addArcanum(FFYRNIG_SPHERE).build().buildSnapshot();
			expect(snap.arcana.minor.items[0].back.resource.current).toBe(2);
		});

		it("back.resource.current defaults to 0 when not in inventory.resources", async () => {
			const actor = new FakeActorBuilder().withFlag("arcana.owned", ["huge-wooden-sphere"]).build();
			const snap = await new TestCharacterBuilder(actor).addArcanum(FFYRNIG_SPHERE).build().buildSnapshot();
			expect(snap.arcana.minor.items[0].back.resource.current).toBe(0);
		});

		it("maxStat resolves to actor's stat value", async () => {
			const actor = new FakeActorBuilder()
				.withFlag("arcana.owned", ["carvings-in-a-cave"])
				.withStats(new FakeStatBuilder().withCon(5))
				.build();
			const snap = await new TestCharacterBuilder(actor).addArcanum(CARVINGS_IN_A_CAVE).build().buildSnapshot();
			expect(snap.arcana.minor.items[0].back.resource.max).toBe(5);
		});

		it("back.item.resource is a resolved Resource on the OutfitItem snapshot", async () => {
			const actor = new FakeActorBuilder()
				.withFlags({
					"arcana.owned":        ["bow-with-no-string"],
					"inventory.resources": { "bow-with-no-string": 1 },
				})
				.build();
			const snap = await new TestCharacterBuilder(actor).addArcanum(BOW_WITH_NO_STRING).build().buildSnapshot();
			const resource = snap.arcana.minor.items[0].back.item.resource;
			expect(resource).not.toBeNull();
			expect(resource.current).toBe(1);
			expect(resource.max).toBe(3);
			expect(resource.title).toBe("Ammo");
		});
	});

	describe("arcana checked state", () => {
		it("checked defaults to false", async () => {
			const actor = new FakeActorBuilder().withFlag("arcana.owned", ["huge-wooden-sphere"]).build();
			const snap = await new TestCharacterBuilder(actor).addArcanum(FFYRNIG_SPHERE).build().buildSnapshot();
			expect(snap.arcana.minor.items[0].checked).toBe(false);
		});

		it("checked is true when slug is in inventory.checked flag", async () => {
			const actor = new FakeActorBuilder()
				.withFlags({
					"arcana.owned":       ["huge-wooden-sphere"],
					"inventory.checked":  { "huge-wooden-sphere": true },
				})
				.build();
			const snap = await new TestCharacterBuilder(actor).addArcanum(FFYRNIG_SPHERE).build().buildSnapshot();
			expect(snap.arcana.minor.items[0].checked).toBe(true);
		});
	});
});
