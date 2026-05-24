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
	slug:     "enfys",
	name:     "Enfys, the Acolyte",
	note:     "Bird-wise, innocent",
	hp:       { max: 6 },
	armor:    0,
	damage:   "bronze knife d4 (hand)",
	instinct: { slug: "instinct", list: [{ type: "text", slug: "value", description: "", default: "to get distracted\n-Speak with birds\n-Ask a difficult question\n-Wander off" }] },
	cost:     "knowledge, secret lore; Loyalty",
	loyalty:  { max: 3 },
	options: {
		slug: "options",
		list: [
			{ type: "heading", title: "Pick 1 on each line" },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "he", label: "he" }, { slug: "she", label: "she" }, { slug: "they", label: "they" }] },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "just-a-child", label: "just a child" }, { slug: "on-the-cusp", label: "on the cusp" }] },
		],
	},
};

const ENFYS = new Follower(ENFYS_DATA);

const PICKER_DATA = {
	slug:     "test-picker",
	name:     "Test Picker",
	note:     null,
	hp:       { max: 4 },
	armor:    0,
	damage:   null,
	instinct: { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "bully", label: "to bully" }, { slug: "scheme", label: "to scheme" }] }] },
	cost:     null,
	loyalty:  { max: 2 },
	options:  null,
};

const PICKER = new Follower(PICKER_DATA);

const CUSTOM_DATA = {
	slug:     "test-custom",
	name:     "Test Custom",
	note:     null,
	hp:       { max: 3 },
	armor:    0,
	damage:   null,
	instinct: null,
	cost:     null,
	loyalty:  { max: 2 },
	options:  null,
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

	it("setLoyalty stores loyalty under state[slug]", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setLoyalty("enfys", 2);
		expect(store.state.enfys.loyalty).toBe(2);
	});

	it("setChoiceValue stores option in values under the given group", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setChoiceValue("enfys", "options", "she", null);
		expect(store.state.enfys.values.options.she).toBe(1);
	});

	it("setChoiceValue clears sibling slugs before setting the chosen option", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setChoiceValue("enfys", "options", "she", "he,she,they");
		expect(store.state.enfys.values.options.she).toBe(1);
		expect(store.state.enfys.values.options.he).toBe(0);
		expect(store.state.enfys.values.options.they).toBe(0);
	});

	it("setChoiceValue stores instinct choice under values.instinct", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setChoiceValue("test-picker", "instinct", "bully", "bully,scheme");
		expect(store.state["test-picker"].values.instinct.bully).toBe(1);
		expect(store.state["test-picker"].values.instinct.scheme).toBe(0);
	});

	it("setInstinctCustom stores text for custom instinct", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setInstinctCustom("enfys", "to wander");
		expect(store.state.enfys.instinctCustom).toBe("to wander");
	});

	it("setInstinctText stores text in values.instinct.value", async () => {
		const store = {};
		const flags = makeFlags(store);
		const cf = new CharacterFollowers(flags, makeFakeRepo());
		await cf.setInstinctText("enfys", "to wander");
		expect(store.state.enfys.values.instinct.value).toBe("to wander");
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

	it("hp defaults to hpMax when no state", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(6);
		expect(snap.hpMax).toBe(6);
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
		expect(snap.damage).toBe("bronze knife d4 (hand)");
	});

	it("damage reflects saved state", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { damage: "d6" } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBe("d6");
	});
});

// -- Tests: instinct snapshot -------------------------------------------------

describe("CharacterFollowers — instinct snapshot", () => {
	it("text instinct has type 'text' with textValue defaulting to pack default", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct.type).toBe("text");
		expect(snap.instinct.group.list[0].textValue).toBe("to get distracted\n-Speak with birds\n-Ask a difficult question\n-Wander off");
	});

	it("text instinct reflects saved state", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { values: { instinct: { value: "to wander aimlessly" } } } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct.group.list[0].textValue).toBe("to wander aimlessly");
	});

	it("choices instinct has type 'choices' with no options checked when unset", async () => {
		const flags = makeFlags({ owned: ["test-picker"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([PICKER]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct.type).toBe("choices");
		const row = snap.instinct.group.list[0];
		expect(row.options.every(o => !o.checked)).toBe(true);
	});

	it("choices instinct marks saved choice as checked", async () => {
		const flags = makeFlags({ owned: ["test-picker"], state: { "test-picker": { values: { instinct: { bully: 1 } } } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([PICKER]));
		const [snap] = await cf.buildSnapshot();
		const row = snap.instinct.group.list[0];
		expect(row.options.find(o => o.slug === "bully").checked).toBe(true);
		expect(row.options.find(o => o.slug === "scheme").checked).toBe(false);
	});

	it("null instinct has type 'custom'", async () => {
		const flags = makeFlags({ owned: ["test-custom"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([CUSTOM]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct.type).toBe("custom");
	});
});

// -- Tests: options snapshot --------------------------------------------------

describe("CharacterFollowers — options snapshot", () => {
	it("heading rows have type 'heading' and title", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.options.list[0].type).toBe("heading");
		expect(snap.options.list[0].title).toBe("Pick 1 on each line");
	});

	it("choice rows have type 'choice', rowKey, options, and inline", async () => {
		const flags = makeFlags({ owned: ["enfys"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		const row = snap.options.list[1];
		expect(row.type).toBe("choice");
		expect(row.inline).toBe(true);
		expect(row.options[0].slug).toBe("he");
	});

	it("saved option slug is marked checked", async () => {
		const flags = makeFlags({ owned: ["enfys"], state: { enfys: { values: { options: { she: 1 } } } } });
		const cf = new CharacterFollowers(flags, makeFakeRepo([ENFYS]));
		const [snap] = await cf.buildSnapshot();
		const firstChoiceRow = snap.options.list[1];
		expect(firstChoiceRow.options.find(o => o.slug === "she").checked).toBe(true);
		expect(firstChoiceRow.options.find(o => o.slug === "he").checked).toBe(false);
	});

	it("options is null when follower has no options", async () => {
		const flags = makeFlags({ owned: ["test-picker"] });
		const cf = new CharacterFollowers(flags, makeFakeRepo([PICKER]));
		const [snap] = await cf.buildSnapshot();
		expect(snap.options).toBeNull();
	});
});
