import { describe, it, expect, vi } from "vitest";
import { CharacterFollowers } from "../../../module/actors/character/CharacterFollowers.js";
import { Follower } from "../../../module/model/data/character/Follower.js";

// -- Helpers ------------------------------------------------------------------

function makeFlags(store = {}) {
	return {
		_store: { ...store },
		getFlag: key => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeFakeRepo(followers = []) {
	return {
		findBySlugs: vi.fn(async slugs => followers.filter(f => slugs.includes(f.slug))),
	};
}

// -- Fixtures -----------------------------------------------------------------

const ENFYS_DATA = {
	slug:    "enfys",
	name:    "Enfys, the Acolyte",
	note:    "Bird-wise, innocent",
	hp:      { max: 6 },
	armor:   0,
	damage:  "d4",
	loyalty: { max: 3 },
	choices: {
		slug: "choices",
		list: [
			{ type: "input", slug: "weapon",   text: "Weapon",   default: "bronze knife d4 (hand)" },
			{ type: "input", slug: "instinct", text: "Instinct", default: "to get distracted\n-Speak with birds\n-Ask a difficult question\n-Wander off" },
			{ type: "input", slug: "cost",     text: "Cost",     default: "knowledge, secret lore; Loyalty" },
			{ type: "heading", title: "Pick 1 on each line" },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "he", text: "he" }, { slug: "she", text: "she" }, { slug: "they", text: "they" }] },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "just-a-child", text: "just a child" }, { slug: "on-the-cusp", text: "on the cusp" }] },
		],
	},
};

const ENFYS = new Follower(ENFYS_DATA);

const PICKER_DATA = {
	slug:    "test-picker",
	name:    "Test Picker",
	note:    null,
	hp:      { max: 4 },
	armor:   0,
	damage:  null,
	loyalty: { max: 2 },
	choices: {
		slug: "choices",
		list: [
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "bully", text: "to bully" }, { slug: "scheme", text: "to scheme" }] },
		],
	},
};

const PICKER = new Follower(PICKER_DATA);

const CUSTOM_DATA = {
	slug:    "test-custom",
	name:    "Test Custom",
	note:    null,
	hp:      { max: 3 },
	armor:   0,
	damage:  null,
	loyalty: { max: 2 },
};

const CUSTOM = new Follower(CUSTOM_DATA);

// -- Tests: ownership ---------------------------------------------------------

describe("CharacterFollowers — ownership", () => {
	it("ownedSlugs returns empty array by default", () => {
		const flags = makeFlags();
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		expect(cf.ownedSlugs).toEqual([]);
	});

	it("addFollower stores slug in owned flag", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.addFollower("enfys");
		expect(store.owned).toContain("enfys");
	});

	it("addFollower does not duplicate slugs", async () => {
		const store = { owned: ["enfys"] };
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.addFollower("enfys");
		expect(store.owned.filter(s => s === "enfys").length).toBe(1);
	});

	it("removeFollower removes slug from owned", async () => {
		const store = { owned: ["enfys"] };
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.removeFollower("enfys");
		expect(store.owned).not.toContain("enfys");
	});

	it("removeFollower cleans state for that slug", async () => {
		const store = { owned: ["enfys"], state: { enfys: { hp: 3 } } };
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.removeFollower("enfys");
		expect(store.state?.enfys).toBeUndefined();
	});
});

// -- Tests: mutations ---------------------------------------------------------

describe("CharacterFollowers — state mutations", () => {
	it("setHp stores hp under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setHp("enfys", 4);
		expect(store.state.enfys.hp).toBe(4);
	});

	it("setHpMax stores hpMax under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setHpMax("enfys", 8);
		expect(store.state.enfys.hpMax).toBe(8);
	});

	it("setName stores name under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setName("enfys", "Enfys the Brave");
		expect(store.state.enfys.name).toBe("Enfys the Brave");
	});

	it("setNote stores note under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setNote("enfys", "Updated notes");
		expect(store.state.enfys.note).toBe("Updated notes");
	});

	it("setLoyalty stores loyalty under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setLoyalty("enfys", 2);
		expect(store.state.enfys.loyalty).toBe(2);
	});

	it("setChoiceValue stores option in values.choices", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setChoiceValue("enfys", "choices", "she", null);
		expect(store.state.enfys.values.choices.she).toBe(1);
	});

	it("setChoiceValue clears sibling slugs before setting the chosen option", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setChoiceValue("enfys", "choices", "she", "he,she,they");
		expect(store.state.enfys.values.choices.she).toBe(1);
		expect(store.state.enfys.values.choices.he).toBe(0);
		expect(store.state.enfys.values.choices.they).toBe(0);
	});

	it("setChoiceText stores text in values.choices[optionSlug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setChoiceText("enfys", "instinct", "to wander aimlessly");
		expect(store.state.enfys.values.choices.instinct).toBe("to wander aimlessly");
	});

	it("setArmor stores armor under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setArmor("enfys", 2);
		expect(store.state.enfys.armor).toBe(2);
	});

	it("setDamage stores damage string under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setDamage("enfys", "d6");
		expect(store.state.enfys.damage).toBe("d6");
	});
});

// -- Tests: buildSnapshot -----------------------------------------------------

describe("CharacterFollowers.buildSnapshot", () => {
	it("returns empty array when no slugs owned", async () => {
		const cf = new CharacterFollowers(makeFlags(), makeFakeRepo());
		expect(await cf.buildSnapshot()).toEqual([]);
	});

	it("returns one snapshot per owned follower", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const snap = await cf.buildSnapshot();
		expect(snap).toHaveLength(1);
	});

	it("snapshot has correct slug and name", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.slug).toBe("enfys");
		expect(snap.name).toBe("Enfys, the Acolyte");
	});

	it("name reflects saved state override", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { name: "Enfys the Renamed" } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("Enfys the Renamed");
	});

	it("note reflects saved state override", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { note: "Updated notes" } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.note).toBe("Updated notes");
	});

	it("hp defaults to hpMax when no state", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(6);
		expect(snap.hpMax).toBe(6);
	});

	it("hpMax reflects saved state override", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { hpMax: 8 } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.hpMax).toBe(8);
	});

	it("hp reflects saved state", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { hp: 3 } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(3);
	});

	it("loyalty defaults to 0 when no state", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty).toBe(0);
		expect(snap.loyaltyMax).toBe(3);
	});

	it("loyalty reflects saved state", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { loyalty: 1 } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty).toBe(1);
	});

	it("armor defaults to pack value when no state", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor).toBe(0);
	});

	it("armor reflects saved state", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { armor: 2 } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor).toBe(2);
	});

	it("damage defaults to pack value when no state", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("d4");
	});

	it("damage reflects saved state", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { damage: "d6" } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("d6");
	});
});

// -- Tests: choices snapshot --------------------------------------------------

describe("CharacterFollowers — choices snapshot", () => {
	it("choices is null when follower has no choices", async () => {
		const flags = makeFlags({ owned: ["test-custom"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([CUSTOM]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).toBeNull();
	});

	it("choices has heading row with title", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		const heading = snap.choices.list.find(r => r.type === "heading");
		expect(heading.title).toBe("Pick 1 on each line");
	});

	it("text rows default to pack default value", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		const weaponRow = snap.choices.list.find(r => r.slug === "weapon");
		expect(weaponRow.value).toBe("bronze knife d4 (hand)");
		const instinctRow = snap.choices.list.find(r => r.slug === "instinct");
		expect(instinctRow.value).toBe("to get distracted\n-Speak with birds\n-Ask a difficult question\n-Wander off");
		const costRow = snap.choices.list.find(r => r.slug === "cost");
		expect(costRow.value).toBe("knowledge, secret lore; Loyalty");
	});

	it("saved text value overrides pack default", async () => {
		const flags = makeFlags({
			owned: ["enfys"],
			state: { enfys: { values: { choices: { instinct: "to wander aimlessly" } } } },
		});
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		const instinctRow = snap.choices.list.find(r => r.slug === "instinct");
		expect(instinctRow.value).toBe("to wander aimlessly");
	});

	it("pick rows have correct options and are unchecked by default", async () => {
		const flags = makeFlags({ owned: ["test-picker"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([PICKER]));
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list[0];
		expect(pickRow.type).toBe("choice");
		expect(pickRow.inline).toBe(true);
		expect(pickRow.options.every(o => !o.checked)).toBe(true);
		expect(pickRow.options[0].slug).toBe("bully");
	});

	it("saved pick value marks option as checked", async () => {
		const flags = makeFlags({
			owned: ["test-picker"],
			state: { "test-picker": { values: { choices: { bully: 1 } } } },
		});
		const cf = new CharacterFollowers(flags, makeFakeRepo([PICKER]));
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list[0];
		expect(pickRow.options.find(o => o.slug === "bully").checked).toBe(true);
		expect(pickRow.options.find(o => o.slug === "scheme").checked).toBe(false);
	});

	it("enfys pick rows include he/she/they options", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		const pickRows = snap.choices.list.filter(r => r.type === "choice");
		const pronounRow = pickRows[0];
		expect(pronounRow.options.map(o => o.slug)).toEqual(["he", "she", "they"]);
	});

	it("saved pronoun choice is reflected in choices", async () => {
		const flags = makeFlags({
			owned: ["enfys"],
			state: { enfys: { values: { choices: { she: 1, he: 0, they: 0 } } } },
		});
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		const pickRows = snap.choices.list.filter(r => r.type === "choice");
		const pronounRow = pickRows[0];
		expect(pronounRow.options.find(o => o.slug === "she").checked).toBe(true);
		expect(pronounRow.options.find(o => o.slug === "he").checked).toBe(false);
	});
});

// -- Fixtures: blank follower -------------------------------------------------

const BLANK_DATA = {
	slug:    "blank",
	name:    "New Follower",
	note:    null,
	hp:      { max: 6 },
	armor:   0,
	damage:  "d6",
	loyalty: { max: 3 },
	choices: {
		slug: "choices",
		list: [
			{ type: "input", slug: "damage",   text: "Damage",   default: "" },
			{ type: "input", slug: "instinct", text: "Instinct", default: "" },
			{ type: "input", slug: "cost",     text: "Cost",     default: "" },
			{ type: "input", slug: "notes",    text: "Notes",    default: "" },
		],
	},
};

const BLANK = new Follower(BLANK_DATA);

// -- Tests: addCustomFollower -------------------------------------------------

describe("CharacterFollowers — addCustomFollower", () => {
	it("throws if blank follower not in repo", async () => {
		const cf = new CharacterFollowers(makeFlags(), makeFakeRepo());
		await expect(cf.addCustomFollower()).rejects.toThrow("Blank follower not found in compendium");
	});

	it("adds a custom- slug to owned", async () => {
		const store = {};
		const cf = new CharacterFollowers(makeFlags(store), makeFakeRepo([BLANK]));
		await cf.addCustomFollower();
		expect(store.owned).toHaveLength(1);
		expect(store.owned[0]).toMatch(/^custom-/);
	});

	it("sets initial state from blank follower values", async () => {
		const store = {};
		const cf = new CharacterFollowers(makeFlags(store), makeFakeRepo([BLANK]));
		await cf.addCustomFollower();
		const slug = store.owned[0];
		expect(store.state[slug].name).toBe("New Follower");
		expect(store.state[slug].hp).toBe(6);
		expect(store.state[slug].hpMax).toBe(6);
		expect(store.state[slug].armor).toBe(0);
		expect(store.state[slug].damage).toBe("d6");
		expect(store.state[slug].loyalty).toBe(0);
	});
});

// -- Tests: custom follower snapshot ------------------------------------------

describe("CharacterFollowers — custom follower snapshot", () => {
	it("buildSnapshot returns a snapshot for a custom slug", async () => {
		const store = { owned: ["custom-1"], state: { "custom-1": { name: "My Guy", hp: 6, hpMax: 6, armor: 0, damage: "d6", loyalty: 0, values: {} } } };
		const cf = new CharacterFollowers(makeFlags(store), makeFakeRepo([BLANK]));
		const snaps = await cf.buildSnapshot();
		expect(snaps).toHaveLength(1);
		expect(snaps[0].slug).toBe("custom-1");
		expect(snaps[0].name).toBe("My Guy");
	});

	it("custom snapshot uses blank follower choices as template", async () => {
		const store = { owned: ["custom-1"], state: { "custom-1": { name: "My Guy", hp: 6, hpMax: 6, armor: 0, damage: "d6", loyalty: 0, values: {} } } };
		const cf = new CharacterFollowers(makeFlags(store), makeFakeRepo([BLANK]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).not.toBeNull();
		expect(snap.choices.list.find(r => r.slug === "instinct")).toBeDefined();
	});

	it("custom snapshot has null choices when blank not available", async () => {
		const store = { owned: ["custom-1"], state: { "custom-1": { name: "My Guy", hp: 6, hpMax: 6, armor: 0, damage: "d6", loyalty: 0, values: {} } } };
		const cf = new CharacterFollowers(makeFlags(store), makeFakeRepo());
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).toBeNull();
	});

	it("loyalty max is always 3 for custom followers", async () => {
		const store = { owned: ["custom-1"], state: { "custom-1": { name: "X", hp: 4, hpMax: 4, armor: 0, damage: "d6", loyalty: 1, values: {} } } };
		const cf = new CharacterFollowers(makeFlags(store), makeFakeRepo([BLANK]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyaltyMax).toBe(3);
	});

	it("loyalty max is always 3 for compendium followers", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyaltyMax).toBe(3);
	});
});
