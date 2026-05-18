import { describe, it, expect, vi } from "vitest";
import { StonetopCharacter } from "../../../module/actors/character/StonetopCharacter.js";
import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	MinorArcanumSnapshot,
} from "../../../module/model/CharacterSnapshot.js";

// -- Fake repositories --------------------------------------------------------

class FakePlaybookRepository {
	async findBySlug() { return null; }
}

class FakePlaybookMoveRepository {
	async getMovesForPlaybook() { return []; }
}

class FakeBasicMoveRepository {
	async getAll() { return []; }
}

class FakeInventoryRepository {
	async getAll() { return []; }
}

class FakeArcanaRepository {
	constructor(arcana = []) { this._arcana = arcana; }
	async findBySlug(slug) { return this._arcana.find(a => a.slug === slug) ?? null; }
	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}

// -- Fake actor ---------------------------------------------------------------

function makeActor({ name = "Tara", system = {}, flags = {}, items = [] } = {}) {
	const flagStore = { stonetop: { ...flags }, pbta: {} };
	return {
		name,
		type: "character",
		system: {
			playbook: { slug: null, name: null },
			stats: {
				str: { value: 0 }, dex: { value: 0 },
				con: { value: 0 }, int: { value: 0 },
				wis: { value: 0 }, cha: { value: 0 },
			},
			attributes: {
				level:   { value: 1 },
				hp:      { value: 10, max: 10 },
				armour:  { value: 0 },
				xp:      { value: 0, max: 8 },
				damage:  { value: "d6" },
				debilities: { options: {
					weakened:  { value: false, stat: ["str", "dex"] },
					dazed:     { value: false, stat: ["int", "wis"] },
					miserable: { value: false, stat: ["con", "cha"] },
				}},
			},
			...system,
		},
		items,
		flags: flagStore,
		getFlag:  (scope, key) => flagStore[scope]?.[key] ?? null,
		setFlag:  vi.fn(async (scope, key, val) => { flagStore[scope] ??= {}; flagStore[scope][key] = val; }),
		update:   vi.fn(),
		createEmbeddedDocuments: vi.fn(),
		deleteEmbeddedDocuments: vi.fn(),
	};
}

function makeCharacter(actor, arcanaRepo = null) {
	return new StonetopCharacter(
		actor,
		new FakePlaybookRepository(),
		new FakePlaybookMoveRepository(),
		new FakeBasicMoveRepository(),
		new FakeInventoryRepository(),
		arcanaRepo ?? new FakeArcanaRepository(),
	);
}

// -- Arcana fixture -----------------------------------------------------------

const FFYRNIG_SPHERE = {
	slug: "huge-wooden-sphere",
	front: {
		title: "A Huge Wooden Sphere",
		weight: null,
		note: "immobile",
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
		weight: 1,
		note: "magical",
		description: "<p>When you pickle fresh ffyrnig root in a suspension of boar bile for two full moons, it becomes a skin of ffyrnig tonic (3 uses, magical).</p>",
		resource: { max: 3, title: "Ffyrnig Tonic", labels: [] },
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
		const snap = await makeCharacter(makeActor()).buildSnapshot();
		expect(snap.arcana).toBeInstanceOf(ArcanaSnapshot);
	});

	it("arcana.minor and arcana.major are ArcanaSectionSnapshot instances", async () => {
		const snap = await makeCharacter(makeActor()).buildSnapshot();
		expect(snap.arcana.minor).toBeInstanceOf(ArcanaSectionSnapshot);
		expect(snap.arcana.major).toBeInstanceOf(ArcanaSectionSnapshot);
	});

	it("arcana.minor.items is [] when no owned slugs", async () => {
		const snap = await makeCharacter(makeActor()).buildSnapshot();
		expect(snap.arcana.minor.items).toEqual([]);
	});

	it("arcana.minor.title is 'Minor Arcana'", async () => {
		const snap = await makeCharacter(makeActor()).buildSnapshot();
		expect(snap.arcana.minor.title).toBe("Minor Arcana");
	});

	describe("with owned arcanum", () => {
		function buildWithFlags(arcanaFlags = {}) {
			const flatFlags = Object.fromEntries(
				Object.entries(arcanaFlags).map(([k, v]) => [`arcana.${k}`, v])
			);
			const actor = makeActor({ flags: flatFlags });
			const char  = makeCharacter(actor, new FakeArcanaRepository([FFYRNIG_SPHERE]));
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
});
