import { describe, it, expect } from "vitest";
import { CharacterFollowers } from "../../../src/actors/character/CharacterFollowers.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { StonetopFlags } from "../../../src/actors/character/StonetopFlags.js";
import { FakeFlags } from "../../fakes/FakeFlags.js";
import { FakeFollowerRepository } from "../../fakes/FakeFollowerRepository.js";
import { Follower } from "../../../src/model/data/character/Follower.js";

// -- Helpers ------------------------------------------------------------------

function makeFollowerFlags() {
	return new StonetopFlags(new FakeFlags(), "followers");
}

function makeResourceController() {
	return new ResourceController(new StonetopFlags(new FakeFlags(), "resources"));
}

function makeCf(repo = null, resourceCtrl = null) {
	return new CharacterFollowers(
		makeFollowerFlags(),
		repo ?? new FakeFollowerRepository(),
		resourceCtrl ?? makeResourceController(),
	);
}

// -- Fixtures -----------------------------------------------------------------

const ENFYS_DATA = {
	slug:    "enfys",
	name:    "Enfys, the Acolyte",
	tags:    "Bird-wise, innocent",
	hp:      { value: 6, min: 0, max: 6 },
	armor:   { value: 0, note: "" },
	damage:  { value: "d4", label: "", tags: "" },
	instinct: "to get distracted\n-Speak with birds\n-Ask a difficult question\n-Wander off",
	loyalty: { value: 0, max: 3 },
	choices: {
		slug: "choices",
		list: [
			{ type: "heading", slug: "weapon", content: { text: "Weapon" }, input: { default: "bronze knife d4 (hand)" } },
			{ type: "heading", slug: "cost",   content: { text: "Cost" },   input: { default: "knowledge, secret lore; Loyalty" } },
			{ type: "heading", content: { title: "Pick 1 on each line" } },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "he", text: "he" }, { slug: "she", text: "she" }, { slug: "they", text: "they" }] },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "just-a-child", text: "just a child" }, { slug: "on-the-cusp", text: "on the cusp" }] },
		],
	},
};

const ENFYS = new Follower(ENFYS_DATA);

const PICKER_DATA = {
	slug:    "test-picker",
	name:    "Test Picker",
	tags:    null,
	hp:      { value: 4, min: 0, max: 4 },
	armor:   { value: 0, note: "" },
	damage:  null,
	instinct: "",
	loyalty: { value: 0, max: 2 },
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
	tags:    null,
	hp:      { value: 3, min: 0, max: 3 },
	armor:   { value: 0, note: "" },
	damage:  null,
	instinct: "",
	loyalty: { value: 0, max: 2 },
};

const CUSTOM = new Follower(CUSTOM_DATA);

// -- Tests: ownership ---------------------------------------------------------

describe("CharacterFollowers — ownership", () => {
	it("ownedSlugs returns empty array by default", () => {
		expect(makeCf().ownedSlugs).toEqual([]);
	});

	it("addFollower stores slug in ownedSlugs", async () => {
		const cf = makeCf();
		await cf.addFollower("enfys");
		expect(cf.ownedSlugs).toContain("enfys");
	});

	it("addFollower does not duplicate slugs", async () => {
		const cf = makeCf();
		await cf.addFollower("enfys");
		await cf.addFollower("enfys");
		expect(cf.ownedSlugs.filter(s => s === "enfys").length).toBe(1);
	});

	it("removeFollower removes slug from ownedSlugs", async () => {
		const cf = makeCf();
		await cf.addFollower("enfys");
		await cf.removeFollower("enfys");
		expect(cf.ownedSlugs).not.toContain("enfys");
	});

	it("removeFollower cleans up associated state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setHp("enfys", 3);
		await cf.removeFollower("enfys");
		// After removal and re-add, HP should revert to pack default
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(6);
	});
});

// -- Tests: state mutations ---------------------------------------------------

describe("CharacterFollowers — state mutations", () => {
	it("setHp is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setHp("enfys", 4);
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(4);
	});

	it("setHpMax is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setHpMax("enfys", 8);
		const [snap] = await cf.buildSnapshot();
		expect(snap.hpMax).toBe(8);
	});

	it("setName is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setName("enfys", "Enfys the Brave");
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("Enfys the Brave");
	});

	it("setTags is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setTags("enfys", "Updated tags");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tags).toBe("Updated tags");
	});

	it("setLoyalty is reflected in buildSnapshot as loyalty.current", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setLoyalty("enfys", 2);
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.current).toBe(2);
	});

	it("setChoiceValue marks option as checked in snapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setChoiceValue("enfys", "choices", "she", null);
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list.find(r => r.type === "choice");
		expect(pickRow.options.find(o => o.slug === "she").checked).toBe(true);
	});

	it("setChoiceValue clears sibling slugs before setting the chosen option", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setChoiceValue("enfys", "choices", "she", "he,she,they");
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list.filter(r => r.type === "choice")[0];
		expect(pickRow.options.find(o => o.slug === "she").checked).toBe(true);
		expect(pickRow.options.find(o => o.slug === "he").checked).toBe(false);
		expect(pickRow.options.find(o => o.slug === "they").checked).toBe(false);
	});


	it("setArmor is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setArmor("enfys", 2);
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor.value).toBe(2);
	});

	it("setDamage is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setDamage("enfys", "d6");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.value).toBe("d6");
	});
});

// -- Tests: buildSnapshot -----------------------------------------------------

describe("CharacterFollowers.buildSnapshot", () => {
	it("returns empty array when no slugs owned and no extra slugs", async () => {
		expect(await makeCf().buildSnapshot()).toEqual([]);
	});

	it("returns one snapshot per owned follower", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const snap = await cf.buildSnapshot();
		expect(snap).toHaveLength(1);
	});

	it("snapshot has correct slug and name", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.slug).toBe("enfys");
		expect(snap.name).toBe("Enfys, the Acolyte");
	});

	it("name defaults to pack data", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("Enfys, the Acolyte");
	});

	it("tags reflects pack data", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tags).toBe("Bird-wise, innocent");
	});

	it("hp defaults to hp.value when no state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(6);
		expect(snap.hpMax).toBe(6);
	});

	it("loyalty defaults to current=0 and max from pack", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.current).toBe(0);
		expect(snap.loyalty.max).toBe(3);
	});

	it("loyalty.current reflects saved loyalty", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setLoyalty("enfys", 1);
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.current).toBe(1);
	});

	it("armor defaults to pack value when no state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor.value).toBe(0);
		expect(snap.armor.note).toBe("");
	});

	it("damage defaults to pack die when no state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.value).toBe("d4");
	});

	it("instinct comes from pack data", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct).toBe("to get distracted\n-Speak with birds\n-Ask a difficult question\n-Wander off");
	});

	it("damage is null when pack damage is null", async () => {
		const cf = makeCf(new FakeFollowerRepository([PICKER]));
		await cf.addFollower("test-picker");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toBeNull();
	});
});

// -- Tests: extraSlugs (arcana-linked followers) -------------------------------

describe("CharacterFollowers.buildSnapshot with extraSlugs", () => {
	it("returns static snapshot for extra slug not in owned", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		const snaps = await cf.buildSnapshot(["enfys"]);
		expect(snaps).toHaveLength(1);
		expect(snaps[0].slug).toBe("enfys");
	});

	it("static snapshot uses pack defaults for HP and loyalty", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		const [snap] = await cf.buildSnapshot(["enfys"]);
		expect(snap.hp).toBe(6);
		expect(snap.loyalty.current).toBe(0);
	});

	it("does not duplicate when extra slug is already owned", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const snaps = await cf.buildSnapshot(["enfys"]);
		expect(snaps).toHaveLength(1);
	});

	it("owned followers appear before extra static snapshots", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS, PICKER]));
		await cf.addFollower("test-picker");
		const snaps = await cf.buildSnapshot(["enfys"]);
		expect(snaps).toHaveLength(2);
		expect(snaps[0].slug).toBe("test-picker");
		expect(snaps[1].slug).toBe("enfys");
	});

	it("silently omits extra slug not found in repo", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		const snaps = await cf.buildSnapshot(["nonexistent"]);
		expect(snaps).toEqual([]);
	});
});

// -- Tests: choices snapshot --------------------------------------------------

describe("CharacterFollowers — choices snapshot", () => {
	it("choices is null when follower has no choices", async () => {
		const cf = makeCf(new FakeFollowerRepository([CUSTOM]));
		await cf.addFollower("test-custom");
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).toBeNull();
	});

	it("choices has heading row with title", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		const heading = snap.choices.list.find(r => r.type === "heading" && r.content.title);
		expect(heading.content.title).toBe("Pick 1 on each line");
	});

	it("heading input rows default to pack default value", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		const weaponRow = snap.choices.list.find(r => r.slug === "weapon");
		expect(weaponRow.input.value).toBe("bronze knife d4 (hand)");
		const costRow = snap.choices.list.find(r => r.slug === "cost");
		expect(costRow.input.value).toBe("knowledge, secret lore; Loyalty");
	});

	it("saved text value overrides pack default", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setChoiceText("enfys", "weapon-input", "iron axe d6 (hand)");
		const [snap] = await cf.buildSnapshot();
		const weaponRow = snap.choices.list.find(r => r.slug === "weapon");
		expect(weaponRow.input.value).toBe("iron axe d6 (hand)");
	});

	it("pick rows have correct options and are unchecked by default", async () => {
		const cf = makeCf(new FakeFollowerRepository([PICKER]));
		await cf.addFollower("test-picker");
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list[0];
		expect(pickRow.type).toBe("choice");
		expect(pickRow.inline).toBe(true);
		expect(pickRow.options.every(o => !o.checked)).toBe(true);
		expect(pickRow.options[0].slug).toBe("bully");
	});

	it("saved pick value marks option as checked", async () => {
		const cf = makeCf(new FakeFollowerRepository([PICKER]));
		await cf.addFollower("test-picker");
		await cf.setChoiceValue("test-picker", "choices", "bully", "bully,scheme");
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list[0];
		expect(pickRow.options.find(o => o.slug === "bully").checked).toBe(true);
		expect(pickRow.options.find(o => o.slug === "scheme").checked).toBe(false);
	});

	it("enfys pick rows include he/she/they options", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		const pickRows = snap.choices.list.filter(r => r.type === "choice");
		const pronounRow = pickRows[0];
		expect(pronounRow.options.map(o => o.slug)).toEqual(["he", "she", "they"]);
	});

	it("saved pronoun choice is reflected in choices", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setChoiceValue("enfys", "choices", "she", "he,she,they");
		const [snap] = await cf.buildSnapshot();
		const pickRows = snap.choices.list.filter(r => r.type === "choice");
		const pronounRow = pickRows[0];
		expect(pronounRow.options.find(o => o.slug === "she").checked).toBe(true);
		expect(pronounRow.options.find(o => o.slug === "he").checked).toBe(false);
	});

	it("instinct row is not in choices (it is a separate field)", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices.list.find(r => r.slug === "instinct")).toBeUndefined();
	});
});

// -- Fixtures: blank follower -------------------------------------------------

const BLANK_DATA = {
	slug:    "blank",
	name:    "New Follower",
	tags:    null,
	hp:      { value: 6, min: 0, max: 6 },
	armor:   { value: 0, note: "" },
	damage:  { value: "d6", label: "", tags: "" },
	instinct: "",
	loyalty: { value: 0, max: 3 },
	choices: {
		slug: "choices",
		list: [
			{ type: "heading", slug: "damage", content: { text: "Damage" }, input: {} },
			{ type: "heading", slug: "cost",   content: { text: "Cost" },   input: {} },
			{ type: "heading", slug: "notes",  content: { text: "Notes" },  input: {} },
		],
	},
};

const BLANK = new Follower(BLANK_DATA);

// -- Tests: addCustomFollower -------------------------------------------------

describe("CharacterFollowers — addCustomFollower", () => {
	it("throws if blank follower not in repo", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		await expect(cf.addCustomFollower()).rejects.toThrow("Blank follower not found in compendium");
	});

	it("adds a custom- slug to ownedSlugs", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		expect(cf.ownedSlugs).toHaveLength(1);
		expect(cf.ownedSlugs[0]).toMatch(/^custom-/);
	});

	it("custom follower appears in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("New Follower");
		expect(snap.hp).toBe(6);
		expect(snap.hpMax).toBe(6);
		expect(snap.armor.value).toBe(0);
	});
});

// -- Tests: custom follower snapshot ------------------------------------------

describe("CharacterFollowers — custom follower snapshot", () => {
	it("buildSnapshot returns a snapshot for a custom slug", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const snaps = await cf.buildSnapshot();
		expect(snaps).toHaveLength(1);
		expect(snaps[0].slug).toMatch(/^custom-/);
	});

	it("custom snapshot uses blank follower choices as template", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).not.toBeNull();
		expect(snap.choices.list.find(r => r.slug === "cost")).toBeDefined();
	});

	it("custom snapshot has null choices when blank not available", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		await cf.addCustomFollower().catch(() => {}); // Will throw; use a pre-seeded custom slug instead
		// Simulate a custom follower state without blank in repo
		const cf2 = new CharacterFollowers(makeFollowerFlags(), new FakeFollowerRepository(), makeResourceController());
		await cf2.addFollower("custom-orphan");
		const [snap] = await cf2.buildSnapshot();
		expect(snap.choices).toBeNull();
	});

	it("loyalty.max is always 3 for custom followers", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		await cf.setLoyalty(cf.ownedSlugs[0], 1);
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.max).toBe(3);
	});

	it("loyalty.max reflects pack data for compendium followers", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.loyalty.max).toBe(3);
	});

	it("custom armor snapshot is an object with value and note", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const slug = cf.ownedSlugs[0];
		await cf.setArmor(slug, 2);
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor).toEqual({ value: 2, note: "" });
	});

	it("custom damage snapshot is an object with die", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const slug = cf.ownedSlugs[0];
		await cf.setDamage(slug, "d8");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage).toEqual({ value: "d8", label: "", tags: "" });
	});
});

// -- Tests: arcanaSlug propagation --------------------------------------------

describe("CharacterFollowers — arcanaSlug", () => {
	const BRONZE_PROTECTOR_DATA = {
		slug:       "bronze-protector",
		name:       "Bronze protector",
		tags:       "Construct, spirit, durable",
		hp:         { value: 13, min: 0, max: 13 },
		armor:      { value: 3, note: "" },
		damage:     { value: "d8", label: "pummel", tags: "band" },
		instinct:   "",
		loyalty:    { value: 0, max: 3 },
		arcanaSlug: "metal-man",
	};
	const BRONZE_PROTECTOR = new Follower(BRONZE_PROTECTOR_DATA);

	it("arcanaSlug is null for regular followers", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.arcanaSlug).toBeNull();
	});

	it("arcanaSlug is propagated from pack data to snapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([BRONZE_PROTECTOR]));
		await cf.addFollower("bronze-protector");
		const [snap] = await cf.buildSnapshot();
		expect(snap.arcanaSlug).toBe("metal-man");
	});
});
