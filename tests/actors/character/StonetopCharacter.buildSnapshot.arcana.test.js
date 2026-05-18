import { describe, it, expect, vi } from "vitest";
import { StonetopCharacter } from "../../../module/actors/character/StonetopCharacter.js";
import {
	ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanaUnlockTextItem, ArcanaUnlockOptionSnapshot,
	ArcanaBackOptionSnapshot,
	MinorArcanumSnapshot, MinorArcanumFrontSnapshot, MinorArcanumBackSnapshot,
	ArcanumUnlockSection,
} from "../../../module/model/CharacterSnapshot.js";

// -- Fake repositories --------------------------------------------------------

class FakePlaybookRepository {
	constructor(playbook = null) { this._playbook = playbook; }
	async findBySlug() { return this._playbook; }
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

function makeCharacter(actor, playbookRepo = null, arcanaRepo = null) {
	return new StonetopCharacter(
		actor,
		playbookRepo  ?? new FakePlaybookRepository(null),
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
		description: "<p>Half-buried and largely overgrown, about 4 feet across and weighing hundreds of pounds. It is strangely well preserved and adorned with intricate pictograms. A handful of other spheres rot nearby.</p>",
		unlock: {
			description: "The pictograms depict some sort of recipe, which you can learn but you must…",
			items: [
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
			description: "<p>pick 1:<br>Regain HP equal to ½ your max<br>Clear a debility</p><p>Also, you have advantage on your next roll to take bold, physical action. But until you take such an action, you have disadvantage on any rolls that require patience, care, or thoughtfulness.</p><p>When you drink a second draught of ffyrnig tonic before getting a good night's sleep, it has no effect other than to make you ill (mark a debility).</p>",
		},
		options: [],
	},
};

const PLAYBOOK_WITH_ARCANA = {
	slug: "the-seeker",
	name: "The Seeker",
	img: null,
	description: "",
	statsNote: null,
	hp: 18,
	damage: "d6",
	startingMovesNote: null,
	specialPossessions: null,
	backgrounds: [],
	instincts: [],
	appearance: [],
	origin: [],
	arcana: {
		minor: {
			title: "Minor Arcana",
			items: ["huge-wooden-sphere"],
		},
		major: {
			title: "Major Arcana",
			items: [],
		},
	},
};

// -- Tests --------------------------------------------------------------------

describe("buildSnapshot() — arcana", () => {
	it("arcana is always present even with no playbook", async () => {
		const actor = makeActor();
		const char  = makeCharacter(actor);
		const snap  = await char.buildSnapshot();
		expect(snap.arcana).toBeInstanceOf(ArcanaSnapshot);
	});

	it("arcana.minor and arcana.major are ArcanaSectionSnapshot instances", async () => {
		const actor = makeActor();
		const char  = makeCharacter(actor);
		const snap  = await char.buildSnapshot();
		expect(snap.arcana.minor).toBeInstanceOf(ArcanaSectionSnapshot);
		expect(snap.arcana.major).toBeInstanceOf(ArcanaSectionSnapshot);
	});

	it("arcana.minor.items is [] when no playbook", async () => {
		const actor = makeActor();
		const char  = makeCharacter(actor);
		const snap  = await char.buildSnapshot();
		expect(snap.arcana.minor.items).toEqual([]);
	});

	it("arcana.minor.items is [] when playbook has no arcana", async () => {
		const playbook = { ...PLAYBOOK_WITH_ARCANA, arcana: undefined };
		const actor = makeActor({ system: { playbook: { slug: "the-seeker", name: "The Seeker" } } });
		const char  = makeCharacter(actor, new FakePlaybookRepository(playbook));
		const snap  = await char.buildSnapshot();
		expect(snap.arcana.minor.items).toEqual([]);
	});

	it("arcana.minor.title defaults to 'Minor Arcana' when no playbook", async () => {
		const actor = makeActor();
		const char  = makeCharacter(actor);
		const snap  = await char.buildSnapshot();
		expect(snap.arcana.minor.title).toBe("Minor Arcana");
	});

	it("arcana.minor.title comes from playbook data", async () => {
		const actor = makeActor({ system: { playbook: { slug: "the-seeker", name: "The Seeker" } } });
		const char  = makeCharacter(actor, new FakePlaybookRepository(PLAYBOOK_WITH_ARCANA));
		const snap  = await char.buildSnapshot();
		expect(snap.arcana.minor.title).toBe("Minor Arcana");
	});

	describe("with the Ffyrnig Sphere fixture", () => {
		const arcanaRepo = new FakeArcanaRepository([FFYRNIG_SPHERE]);

		async function buildWithFlags(arcanaFlags = {}) {
			const flatFlags = Object.fromEntries(
				Object.entries(arcanaFlags).map(([k, v]) => [`arcana.${k}`, v])
			);
			const actor = makeActor({
				system: { playbook: { slug: "the-seeker", name: "The Seeker" } },
				flags: flatFlags,
			});
			const char = makeCharacter(actor, new FakePlaybookRepository(PLAYBOOK_WITH_ARCANA), arcanaRepo);
			const snap = await char.buildSnapshot();
			return snap.arcana.minor.items[0];
		}

		it("returns a MinorArcanumSnapshot", async () => {
			const item = await buildWithFlags();
			expect(item).toBeInstanceOf(MinorArcanumSnapshot);
		});

		it("has correct slug", async () => {
			const item = await buildWithFlags();
			expect(item.slug).toBe("huge-wooden-sphere");
		});

		it("front is a MinorArcanumFrontSnapshot with correct fields", async () => {
			const item = await buildWithFlags();
			expect(item.front).toBeInstanceOf(MinorArcanumFrontSnapshot);
			expect(item.front.title).toBe("A Huge Wooden Sphere");
			expect(item.front.weight).toBeNull();
			expect(item.front.note).toBe("immobile");
			expect(item.front.description).toContain("Half-buried and largely overgrown");
		});

		it("front.unlock is an ArcanumUnlockSection with correct description", async () => {
			const item = await buildWithFlags();
			expect(item.front.unlock).toBeInstanceOf(ArcanumUnlockSection);
			expect(item.front.unlock.description).toBe("The pictograms depict some sort of recipe, which you can learn but you must…");
		});

		it("front.unlock.items has text and option nodes in order", async () => {
			const item = await buildWithFlags();
			const { items } = item.front.unlock;
			expect(items).toHaveLength(5);
			expect(items[0]).toBeInstanceOf(ArcanaUnlockTextItem);
			expect(items[1]).toBeInstanceOf(ArcanaUnlockOptionSnapshot);
			expect(items[2]).toBeInstanceOf(ArcanaUnlockOptionSnapshot);
			expect(items[3]).toBeInstanceOf(ArcanaUnlockTextItem);
			expect(items[3].content).toBe("And then…");
			expect(items[4]).toBeInstanceOf(ArcanaUnlockOptionSnapshot);
		});

		it("unlock option has slug and description", async () => {
			const item = await buildWithFlags();
			const opt = item.front.unlock.items[1];
			expect(opt.slug).toBe("dig-sphere");
			expect(opt.description).toBe("… first dig up and clean the sphere.");
		});

		it("unlock option defaults to count 0 and selected false", async () => {
			const item = await buildWithFlags();
			const opt = item.front.unlock.items[1];
			expect(opt.count).toBe(0);
			expect(opt.selected).toBe(false);
		});

		it("unlock option max defaults to 1", async () => {
			const item = await buildWithFlags();
			const opt = item.front.unlock.items[1];
			expect(opt.max).toBe(1);
		});

		it("unlock option with explicit max reflects JSON value", async () => {
			const item = await buildWithFlags();
			const opt = item.front.unlock.items[4];
			expect(opt.max).toBe(3);
		});

		it("unlock option count and selected reflect saved flags", async () => {
			const item = await buildWithFlags({ unlock: { "huge-wooden-sphere:dig-sphere": 1 } });
			const opt  = item.front.unlock.items[1];
			expect(opt.count).toBe(1);
			expect(opt.selected).toBe(true);
		});

		it("back is a MinorArcanumBackSnapshot with correct fields", async () => {
			const item = await buildWithFlags();
			expect(item.back).toBeInstanceOf(MinorArcanumBackSnapshot);
			expect(item.back.title).toBe("Ffyrnig Tonic");
			expect(item.back.weight).toBe(1);
			expect(item.back.note).toBe("magical");
			expect(item.back.description).toContain("pickle fresh ffyrnig root");
		});

		it("back.resource is populated from JSON and defaults current to 0", async () => {
			const item = await buildWithFlags();
			expect(item.back.resource).toMatchObject({ current: 0, max: 3, title: "Ffyrnig Tonic" });
		});

		it("back.resource.current reflects saved flag", async () => {
			const item = await buildWithFlags({ resources: { "huge-wooden-sphere": 2 } });
			expect(item.back.resource.current).toBe(2);
		});

		it("back.resource is null when absent in JSON", async () => {
			const noResource  = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, resource: undefined } };
			const actor = makeActor({ system: { playbook: { slug: "the-seeker", name: "The Seeker" } } });
			const snap  = await makeCharacter(
				actor,
				new FakePlaybookRepository(PLAYBOOK_WITH_ARCANA),
				new FakeArcanaRepository([noResource]),
			).buildSnapshot();
			expect(snap.arcana.minor.items[0].back.resource).toBeNull();
		});

		it("back.move is populated from JSON with null rollType", async () => {
			const item = await buildWithFlags();
			expect(item.back.move).toMatchObject({
				name:     "When you take a draught of ffyrnig tonic",
				rollType: null,
			});
			expect(item.back.move.description).toContain("pick 1");
		});

		it("back.move is null when absent in JSON", async () => {
			const noMove = { ...FFYRNIG_SPHERE, back: { ...FFYRNIG_SPHERE.back, move: undefined } };
			const actor  = makeActor({ system: { playbook: { slug: "the-seeker", name: "The Seeker" } } });
			const snap   = await makeCharacter(
				actor,
				new FakePlaybookRepository(PLAYBOOK_WITH_ARCANA),
				new FakeArcanaRepository([noMove]),
			).buildSnapshot();
			expect(snap.arcana.minor.items[0].back.move).toBeNull();
		});

		it("back.options is empty for this arcanum", async () => {
			const item = await buildWithFlags();
			expect(item.back.options).toEqual([]);
		});

		it("owned is false by default", async () => {
			const item = await buildWithFlags();
			expect(item.owned).toBe(false);
		});

		it("owned is true when slug is in owned flag", async () => {
			const item = await buildWithFlags({ owned: ["huge-wooden-sphere"] });
			expect(item.owned).toBe(true);
		});

		it("flipped is false by default", async () => {
			const item = await buildWithFlags();
			expect(item.flipped).toBe(false);
		});

		it("flipped is true when slug is in flipped flag", async () => {
			const item = await buildWithFlags({ flipped: ["huge-wooden-sphere"] });
			expect(item.flipped).toBe(true);
		});
	});

	describe("back options — with a synthetic arcanum that has selectable options", () => {
		const ARCANUM_WITH_BACK_OPTS = {
			slug: "test-arcanum",
			front: {
				title: "Test Arcanum (front)",
				weight: null,
				note: null,
				description: "<p>Test.</p>",
				unlock: {
					description: "Unlock by…",
					items: [],
				},
			},
			back: {
				title: "Test Arcanum",
				weight: null,
				note: null,
				description: "<p>Test.</p>",
				resource: null,
				move: null,
				options: [
					{ slug: "opt-a", description: "<p>Option A.</p>", max: 1 },
					{ slug: "opt-b", description: "<p>Option B.</p>", max: 2 },
				],
			},
		};

		const playbook    = { ...PLAYBOOK_WITH_ARCANA, arcana: { ...PLAYBOOK_WITH_ARCANA.arcana, minor: { title: "Minor Arcana", items: ["test-arcanum"] } } };
		const arcanaRepo  = new FakeArcanaRepository([ARCANUM_WITH_BACK_OPTS]);

		async function buildWithFlags(arcanaFlags = {}) {
			const flatFlags = Object.fromEntries(
				Object.entries(arcanaFlags).map(([k, v]) => [`arcana.${k}`, v])
			);
			const actor = makeActor({
				system: { playbook: { slug: "the-seeker", name: "The Seeker" } },
				flags: flatFlags,
			});
			const snap = await makeCharacter(actor, new FakePlaybookRepository(playbook), arcanaRepo).buildSnapshot();
			return snap.arcana.minor.items[0];
		}

		it("back.options are ArcanaBackOptionSnapshot instances with correct fields", async () => {
			const item = await buildWithFlags();
			expect(item.back.options).toHaveLength(2);
			const opt = item.back.options[0];
			expect(opt).toBeInstanceOf(ArcanaBackOptionSnapshot);
			expect(opt.slug).toBe("opt-a");
			expect(opt.description).toBe("<p>Option A.</p>");
			expect(opt.max).toBe(1);
			expect(opt.count).toBe(0);
			expect(opt.selected).toBe(false);
		});

		it("back option max > 1 reflects JSON value", async () => {
			const item = await buildWithFlags();
			expect(item.back.options[1].max).toBe(2);
		});

		it("back option count and selected reflect saved flags", async () => {
			const item = await buildWithFlags({ backOptions: { "test-arcanum:opt-a": 1 } });
			const opt  = item.back.options[0];
			expect(opt.count).toBe(1);
			expect(opt.selected).toBe(true);
		});
	});
});
