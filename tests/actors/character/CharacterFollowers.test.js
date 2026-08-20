import { describe, it, expect } from "vitest";
import { GrantedItems } from "../../../src/actors/GrantedItems.js";
import { CharacterFollowers } from "../../../src/actors/character/CharacterFollowers.js";
import { ChoiceGroupControllerFactory } from "../../../src/actors/character/ChoiceGroupControllerFactory.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeFollowerRepository } from "../../fakes/FakeFollowerRepository.js";
import { Follower } from "../../../src/model/data/character/Follower.js";

// -- Helpers ------------------------------------------------------------------

function makeActor() {
	return new FakeCharacterActorBuilder().build();
}

function makeResourceController() {
	return new ResourceController(new FakeCharacterActorBuilder().build());
}

function makeCf(repo = null, resourceCtrl = null) {
	const actor = makeActor();
	return new CharacterFollowers(
		actor,
		repo ?? new FakeFollowerRepository(),
		resourceCtrl ?? makeResourceController(),
		new ChoiceGroupControllerFactory(actor),
	);
}

function makeFollowerItem(data, overrides = {}) {
	return {
		_id: (data.slug ?? "unknown") + "-item",
		type: "follower",
		name: data.name ?? data.slug,
		system: {
			slug:             data.slug,
			owned:            overrides.owned ?? false,
			tagList:     data.tags ?? "",
			hp:               { value: data.hp?.value ?? 0, max: data.hp?.max ?? 0 },
			armor:            data.armor ?? "",
			damage:           data.damage ?? "",
			instinct:         data.instinct ?? "",
			moves:            data.moves ?? "",
			cost:             data.cost ?? "",
			loyalty:          { value: 0, max: data.loyalty?.max ?? 3 },
			choices:          data.choices ?? null,
			arcanaSlug:       data.arcanaSlug ?? null,
			playbookSlug:     data.playbookSlug ?? null,
			specialQuality:   data.specialQuality ?? "",
			notes:            data.notes ?? "",
			choiceValues:     {},
			members:          data.members ?? [],
		},
	};
}

// -- Fixtures -----------------------------------------------------------------

const ENFYS_DATA = {
	slug:    "enfys",
	name:    "Enfys, the Acolyte",
	tags:    "Bird-wise, innocent",
	hp:      { value: 6, max: 6 },
	armor:   "",
	damage:  "bronze knife d4 (hand)",
	instinct: "to get distracted",
	moves:   "- Speak with birds\n- Ask a difficult question\n- Wander off",
	cost:    "knowledge, secret lore; Loyalty",
	loyalty: { value: 0, max: 3 },
	choices: [{
		slug: "choices",
		list: [
			{ type: "heading", content: { title: "Pick 1 on each line" } },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "he", text: "he" }, { slug: "she", text: "she" }, { slug: "they", text: "they" }] },
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "just-a-child", text: "just a child" }, { slug: "on-the-cusp", text: "on the cusp" }] },
		],
	}],
};

const ENFYS = new Follower(ENFYS_DATA);

const PICKER_DATA = {
	slug:    "test-picker",
	name:    "Test Picker",
	tags:    null,
	hp:      { value: 4, max: 4 },
	armor:   "",
	damage:  "",
	instinct: "",
	loyalty: { value: 0, max: 2 },
	choices: [{
		slug: "choices",
		list: [
			{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "bully", text: "to bully" }, { slug: "scheme", text: "to scheme" }] },
		],
	}],
};

const PICKER = new Follower(PICKER_DATA);

const CUSTOM_DATA = {
	slug:    "test-custom",
	name:    "Test Custom",
	tags:    null,
	hp:      { value: 3, max: 3 },
	armor:   "",
	damage:  "",
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
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		expect(cf.ownedSlugs).toContain("enfys");
	});

	it("addFollower does not duplicate slugs", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.addFollower("enfys");
		expect(cf.ownedSlugs.filter(s => s === "enfys").length).toBe(1);
	});

	it("embeds a defined follower at full HP even when the pack stores value 0", async () => {
		const tmpl = new Follower({ slug: "rook", name: "Rook", hp: { value: 0, max: 8 } });
		const cf = makeCf(new FakeFollowerRepository([tmpl]));
		await cf.addFollower("rook");
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(8);
		expect(snap.hpMax).toBe(8);
	});

	it("removeFollower removes slug from ownedSlugs", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
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
		await cf.controllerFor("enfys")?.selectOption("choices", "she", null);
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list.find(r => r.type === "choice");
		expect(pickRow.options.find(o => o.slug === "she").checked).toBe(true);
	});

	it("setChoiceValue clears sibling slugs before setting the chosen option", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.controllerFor("enfys")?.selectOption("choices", "she", "he,she,they");
		const [snap] = await cf.buildSnapshot();
		const pickRow = snap.choices.list.filter(r => r.type === "choice")[0];
		expect(pickRow.options.find(o => o.slug === "she").checked).toBe(true);
		expect(pickRow.options.find(o => o.slug === "he").checked).toBe(false);
		expect(pickRow.options.find(o => o.slug === "they").checked).toBe(false);
	});


	it("setArmor is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setArmor("enfys", "2 (resilience), 0 vs. bronze");
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor.raw).toBe("2 (resilience), 0 vs. bronze");
	});

	// The single-line fields normalize here rather than at the sheet, so every caller (sheet,
	// drop pipeline, grant) stores the same thing — an untrimmed value would never match a
	// picker option and would silently become a custom entry.
	it("trims the single-line follower fields", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setArmor("enfys", "  1 (hide)  ");
		await cf.setDamage("enfys", "  d6  ");
		await cf.setInstinct("enfys", "  to protect  ");
		await cf.setCost("enfys", "  a warm bed  ");
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor.raw).toBe("1 (hide)");
		expect(snap.damage.raw).toBe("d6");
		expect(snap.instinct).toBe("to protect");
		expect(snap.cost).toBe("a warm bed");
	});

	it("exposes instinct as selection text and moves as RichText (raw markdown)", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setInstinct("enfys", "to **protect**");
		await cf.setMoves("enfys", "- Bite d6\n- Lash out (d8+1)");
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct).toBe("to **protect**");   // rendered as a pill (Selection), not rich text
		expect(snap.moves.raw).toBe("- Bite d6\n- Lash out (d8+1)");
	});

	it("exposes damage and armor as RichText carrying raw markdown (damage rolls dice)", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setDamage("enfys", "**bronze knife** d4 (hand)");
		await cf.setArmor("enfys", "*tough* hide");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.raw).toBe("**bronze knife** d4 (hand)");
		expect(snap.damage.autoRoll).toBe(true);
		expect(snap.armor.raw).toBe("*tough* hide");
		expect(snap.armor.autoRoll).toBe(false);
	});

	it("setDamage is reflected in buildSnapshot", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setDamage("enfys", "d6");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.raw).toBe("d6");
	});

	it("setSpecialQuality and setDescription are reflected in buildSnapshot as RichText", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		await cf.setSpecialQuality("enfys", "Immune to *fear*");
		await cf.setDescription("enfys", "A loyal **hound**.");
		const [snap] = await cf.buildSnapshot();
		expect(snap.specialQuality.raw).toBe("Immune to *fear*");
		expect(snap.description.raw).toBe("A loyal **hound**.");
	});
});

// -- Tests: group members -----------------------------------------------------

const CREW_DATA = {
	slug: "crew",
	name: "The Crew",
	tags: { selected: ["group"], options: ["group"], multi: true, allowCustom: true },
	hp:   { value: 6, max: 6 },
	members: [
		{ name: "Aedith", hp: { value: 6, max: 6 } },
		{ name: "Bryn",   hp: { value: 6, max: 6 } },
	],
	memberSuggestions: { names: ["Aled", "Eira"], tags: ["big", "brave"], traits: ["scars", "snores"] },
};
const CREW = new Follower(CREW_DATA);

describe("CharacterFollowers — group members", () => {
	async function addCrew() {
		const cf = makeCf(new FakeFollowerRepository([CREW]));
		await cf.addFollower("crew");
		return cf;
	}

	it("embeds group members and flags the follower as a group", async () => {
		const [snap] = await (await addCrew()).buildSnapshot();
		expect(snap.isGroup).toBe(true);
		expect(snap.members).toHaveLength(2);
		expect(snap.members[0]).toMatchObject({ index: 0, name: "Aedith", hp: { value: 6, max: 6 } });
	});

	it("addMember appends a member at full (shared-max) HP", async () => {
		const cf = await addCrew();
		await cf.addMember("crew");
		const [snap] = await cf.buildSnapshot();
		expect(snap.members).toHaveLength(3);
		expect(snap.members[2].hp).toEqual({ value: 6, max: 6 });
	});

	it("addMember stamps the group tag on a follower that lacks it", async () => {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "lone", tags: "" }, { owned: true }));
		await cf.addMember("lone");
		expect(cf._actor.items.get("lone-item").system.tagList.selected).toEqual(["group"]);
	});

	it("addMember leaves a horde tagged horde — it is already a group, so it gains no second tag", async () => {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "lone", tags: "horde" }, { owned: true }));
		await cf.addMember("lone");
		expect(cf._actor.items.get("lone-item").system.tagList.selected).toEqual(["horde"]);
	});

	it("a horde follower is a group: members render off the horde tag alone", async () => {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "lone", tags: "horde" }, { owned: true }));
		await cf.addMember("lone");
		const [snap] = await cf.buildSnapshot();
		expect(snap.isGroup).toBe(true);
		expect(snap.members).toHaveLength(1);
	});

	it("removeMember drops the member at the given index", async () => {
		const cf = await addCrew();
		await cf.removeMember("crew", 0);
		const [snap] = await cf.buildSnapshot();
		expect(snap.members.map(m => m.name)).toEqual(["Bryn"]);
	});

	it("setMemberName / setMemberHp update only the targeted member", async () => {
		const cf = await addCrew();
		await cf.setMemberName("crew", 1, "Bryn the Bold");
		await cf.setMemberHp("crew", 1, 2);
		const [snap] = await cf.buildSnapshot();
		expect(snap.members[0]).toMatchObject({ name: "Aedith", hp: { value: 6, max: 6 } });
		expect(snap.members[1]).toMatchObject({ name: "Bryn the Bold", hp: { value: 2, max: 6 } });
	});

	it("each member's tag/trait dropdown options come from the group's memberSuggestions", async () => {
		const [snap] = await (await addCrew()).buildSnapshot();
		expect(snap.memberSuggestions.names).toEqual(["Aled", "Eira"]);
		expect(snap.members[0].tagSelection.options).toEqual(["big", "brave"]);
		expect(snap.members[0].traitSelection.options).toEqual(["scars", "snores"]);
	});

	it("adding or removing a member leaves the FOLLOWER's own tags untouched (regression)", async () => {
		const cf = await addCrew();
		await cf.addMember("crew");
		let [snap] = await cf.buildSnapshot();
		expect(snap.isGroup).toBe(true);
		expect(snap.tagSelection.values).toContain("group");
		await cf.removeMember("crew", 0);
		[snap] = await cf.buildSnapshot();
		expect(snap.isGroup).toBe(true);
		expect(snap.tagSelection.values).toContain("group");
	});

	it("member tags are independent: toggling one member's tag never touches another member or the follower", async () => {
		const cf = await addCrew();
		await cf.toggleMemberSelection("crew", 0, "tags", "big");
		const [snap] = await cf.buildSnapshot();
		expect(snap.members[0].tagSelection.values).toEqual(["big"]);
		expect(snap.members[1].tagSelection.values).toEqual([]);
		expect(snap.tagSelection.values).not.toContain("big");
		expect(snap.tagSelection.values).toContain("group");
	});

	it("toggleMemberSelection adds/removes a tag or trait on one member only", async () => {
		const cf = await addCrew();
		await cf.toggleMemberSelection("crew", 0, "tags", "big");
		await cf.toggleMemberSelection("crew", 0, "traits", "scars");
		let [snap] = await cf.buildSnapshot();
		expect(snap.members[0].tagSelection.values).toEqual(["big"]);
		expect(snap.members[0].traitSelection.values).toEqual(["scars"]);
		expect(snap.members[1].tagSelection.values).toEqual([]);
		// toggling again removes it
		await cf.toggleMemberSelection("crew", 0, "tags", "big");
		[snap] = await cf.buildSnapshot();
		expect(snap.members[0].tagSelection.values).toEqual([]);
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

	it("img reflects the follower's pack icon", async () => {
		const withArt = new Follower({ slug: "art", name: "Arty", img: "systems/stonetop/assets/content/icons/npc.png" });
		const cf = makeCf(new FakeFollowerRepository([withArt]));
		await cf.addFollower("art");
		const [snap] = await cf.buildSnapshot();
		expect(snap.img).toBe("systems/stonetop/assets/content/icons/npc.png");
	});

	it("img is null when the follower has no icon", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.img).toBeNull();
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
		expect(snap.armor.raw).toBe("");
	});

	it("damage defaults to pack die when no state", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.raw).toBe("bronze knife d4 (hand)");
	});

	it("instinct comes from pack data", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct).toBe("to get distracted");
	});

	it("damage is empty string when pack damage is null", async () => {
		const cf = makeCf(new FakeFollowerRepository([PICKER]));
		await cf.addFollower("test-picker");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.raw).toBe("");
	});
});

// -- Tests: buildSnapshot renders OWNED followers only -------------------------
// buildSnapshot derives its set entirely from the actor's owned follower items — nothing is passed in,
// and an embedded-but-unowned follower (owned:false) is not rendered.

describe("CharacterFollowers.buildSnapshot — owned only", () => {
	it("does not render an embedded follower that is not owned", async () => {
		const actor = makeActor();
		actor.items.push(makeFollowerItem({ ...ENFYS_DATA, owned: false }));
		const cf = new CharacterFollowers(actor, new FakeFollowerRepository(), makeResourceController());
		expect(await cf.buildSnapshot()).toEqual([]);
	});

	it("renders an embedded follower once it is owned", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const snaps = await cf.buildSnapshot();
		expect(snaps).toHaveLength(1);
		expect(snaps[0].slug).toBe("enfys");
	});
});

// -- Tests: buildFollowersSnapshot — the normalized { bySlug, tab } authority --

const RING = new Follower({
	slug: "the-ring", name: "The Ring", kind: "object", tags: null,
	hp: { value: 0, max: 0 }, armor: "", damage: "", instinct: "", loyalty: { value: 0, max: 3 },
});

describe("CharacterFollowers.buildFollowersSnapshot — normalized { bySlug, tab }", () => {
	it("bySlug holds every owned follower; tab lists only the showOnTab ones", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS, RING]));
		await cf.addFollower("enfys");                          // showOnTab default true
		await cf.addFollower("the-ring", { showOnTab: false }); // card-only (the Ring)
		const snap = await cf.buildFollowersSnapshot();
		expect(Object.keys(snap.bySlug).sort()).toEqual(["enfys", "the-ring"]);
		expect(snap.tab).toEqual(["enfys"]);                    // the-ring owned but off the tab
		expect(snap.bySlug["the-ring"]).toBeTruthy();           // still resolvable for its inline card
		expect(snap.bySlug["the-ring"].isObject).toBe(true);
	});

	it("tabCards resolves the tab slugs to shared bySlug references (no duplication)", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const snap = await cf.buildFollowersSnapshot();
		expect(snap.tabCards).toHaveLength(1);
		expect(snap.tabCards[0]).toBe(snap.bySlug["enfys"]);    // same object, not a copy
	});

	it("an owned follower carries its kind through to the card", async () => {
		const cf = makeCf(new FakeFollowerRepository([RING]));
		await cf.addFollower("the-ring", { showOnTab: false });
		const snap = await cf.buildFollowersSnapshot();
		expect(snap.get("the-ring").isObject).toBe(true);
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
		const heading = snap.choices.list.find(r => r.type === "entry" && r.content.title.raw);
		expect(heading.content.title.raw).toBe("Pick 1 on each line");
	});

	it("filters promoted entries (weapon/damage/cost/notes) out of the pick rows", async () => {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices.list.find(r => r.slug === "weapon")).toBeUndefined();
		expect(snap.choices.list.find(r => r.slug === "cost")).toBeUndefined();
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
		await cf.controllerFor("test-picker")?.selectOption("choices", "bully", "bully,scheme");
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
		await cf.controllerFor("enfys")?.selectOption("choices", "she", "he,she,they");
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
	hp:      { value: 6, max: 6 },
	armor:   "",
	damage:  "",
	instinct: "",
	loyalty: { value: 0, max: 3 },
	choices: [{ slug: "blank", list: [] }],
};

const BLANK = new Follower(BLANK_DATA);

// -- Tests: addCustomFollower -------------------------------------------------

describe("CharacterFollowers — addCustomFollower", () => {
	it("does not throw if blank follower not in repo", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		await expect(cf.addCustomFollower()).resolves.not.toThrow();
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
		expect(snap.armor.raw).toBe("");
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

	it("custom snapshot from blank has its promoted entries filtered out of pick rows", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const [snap] = await cf.buildSnapshot();
		expect(snap.choices).not.toBeNull();
		expect(snap.choices.list.find(r => r.slug === "cost")).toBeUndefined();
	});

	it("custom snapshot has null choices when blank not available", async () => {
		const cf = makeCf(new FakeFollowerRepository());
		await cf.addCustomFollower();
		const [snap] = await cf.buildSnapshot();
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

	it("custom armor snapshot is the prose string", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const slug = cf.ownedSlugs[0];
		await cf.setArmor(slug, "2 (shield)");
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor.raw).toBe("2 (shield)");
	});

	it("custom damage snapshot is the prose string", async () => {
		const cf = makeCf(new FakeFollowerRepository([BLANK]));
		await cf.addCustomFollower();
		const slug = cf.ownedSlugs[0];
		await cf.setDamage(slug, "bronze knife d8 (hand)");
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.raw).toBe("bronze knife d8 (hand)");
	});
});


// -- Tests: addFromNpcActor (drag an NPC actor onto the sheet) -----------------

function makeNpcActor(overrides = {}) {
	return {
		name: overrides.name ?? "Garm the Guard",
		type: "follower",
		system: {
			...(overrides.tagList ? { tagList: overrides.tagList } : {}),
			hp:             overrides.hp             ?? { value: 8, max: 10 },
			armor:          overrides.armor          ?? "2 (resilience)",
			damage:         overrides.damage         ?? "claws d8 (hand)",
			specialQuality: overrides.specialQuality ?? "Fierce",
			instinct:       overrides.instinct       ?? "to protect the gate",
			description:    overrides.description    ?? "A grizzled guard.",
		},
	};
}

describe("CharacterFollowers — addFromNpcActor", () => {
	function makeCfWithActor(repo = null) {
		const actor = makeActor();
		const cf = new CharacterFollowers(
			actor,
			repo ?? new FakeFollowerRepository(),
			makeResourceController(),
			new ChoiceGroupControllerFactory(actor),
		);
		return { actor, cf };
	}

	it("creates an owned custom- follower", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		expect(cf.ownedSlugs).toHaveLength(1);
		expect(cf.ownedSlugs[0]).toMatch(/^custom-/);
	});

	it("maps the NPC name to the item name", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.name).toBe("Garm the Guard");
	});

	it("maps hp and maxHp to hp value and max", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.hp).toBe(8);
		expect(snap.hpMax).toBe(10);
	});

	it("uses hp value for max when the NPC max is 0", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor({ hp: { value: 8, max: 0 } }));
		const [snap] = await cf.buildSnapshot();
		expect(snap.hpMax).toBe(8);
	});

	it("copies the NPC armor string", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.armor.raw).toBe("2 (resilience)");
	});

	it("copies the NPC damage prose string", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.damage.raw).toBe("claws d8 (hand)");
	});

	it("maps instinct", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinct).toBe("to protect the gate");
	});

	it("maps specialQuality to specialQuality", async () => {
		const { actor, cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const created = actor.createdDocs.at(-1);
		expect(created.system.specialQuality).toBe("Fierce");
	});

	it("maps description", async () => {
		const { actor, cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor());
		const created = actor.createdDocs.at(-1);
		expect(created.system.description).toBe("A grizzled guard.");
	});

	it("canonicalizes a 'Group (3)' NPC tag to 'group' and seeds 3 members at the group max HP", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor({
			tagList: { selected: ["Group (3)", "undead"], options: [], multi: true, allowCustom: true },
			hp: { value: 0, max: 13 },
		}));
		const [snap] = await cf.buildSnapshot();
		expect(snap.tagSelection.values).toEqual(["group", "undead"]);
		expect(snap.isGroup).toBe(true);
		expect(snap.members).toHaveLength(3);
		expect(snap.members.map(m => m.hp)).toEqual([
			{ value: 13, max: 13 }, { value: 13, max: 13 }, { value: 13, max: 13 },
		]);
	});

	it("canonicalizes a bare 'Group' tag but leaves the crew empty without a count", async () => {
		const { cf } = makeCfWithActor();
		await cf.addFromNpcActor(makeNpcActor({
			tagList: { selected: ["Group", "beast"], options: [], multi: true, allowCustom: true },
		}));
		const [snap] = await cf.buildSnapshot();
		expect(snap.tagSelection.values).toEqual(["group", "beast"]);
		expect(snap.isGroup).toBe(true);
		expect(snap.members).toHaveLength(0);
	});
});

// -- arcanumGrants ------------------------------------------------------------

describe("CharacterFollowers.arcanumGrants", () => {
	const ASTOR = new Follower({ slug: "astor", name: "Astor", hp: { value: 4, max: 4 }, armor: "0", damage: "d4" });

	function setup(repoFollowers = []) {
		const actor = makeActor();
		const cf = new CharacterFollowers(
			actor, new FakeFollowerRepository(repoFollowers), makeResourceController(),
			new ChoiceGroupControllerFactory(actor),
		);
		return { actor, cf };
	}

	it("grants the card's followers owned but off the roster tab", async () => {
		const { actor, cf } = setup([ASTOR]);
		await new GrantedItems(actor).sync(await cf.arcanumGrants("blackwood", ["astor"]));
		const item = actor.createdDocs.find(d => d.system?.slug === "astor");
		expect(item.system.owned).toBe(true);
		expect(item.system.showOnTab).toBe(false);
	});

	// The stamp is what lets removing the card take its followers back — it used to depend on
	// `system.arcanaSlug` surviving in the pack data.
	it("stamps them with the arcanum that granted them", async () => {
		const { actor, cf } = setup([ASTOR]);
		await new GrantedItems(actor).sync(await cf.arcanumGrants("blackwood", ["astor"]));
		expect(actor.createdDocs[0].flags.stonetop.grant)
			.toEqual({ source: "arcana:blackwood", key: "follower:astor" });
	});

	it("grants nothing for a card that references no followers", async () => {
		const { cf } = setup([ASTOR]);
		expect((await cf.arcanumGrants("blackwood", [])).isEmpty).toBe(true);
		expect((await cf.arcanumGrants(null, ["astor"])).isEmpty).toBe(true);
	});

	it("yields to a follower the character already has", async () => {
		const { actor, cf } = setup([ASTOR]);
		actor.items.push(makeFollowerItem({ slug: "astor" }, { owned: true }));
		await new GrantedItems(actor).sync(await cf.arcanumGrants("blackwood", ["astor"]));
		expect(actor.createdDocs).toEqual([]);
	});
});

// -- syncPlaybookFollowers ----------------------------------------------------

describe("CharacterFollowers.playbookGrants", () => {
	function setup(repoFollowers = []) {
		const actor = makeActor();
		const cf = new CharacterFollowers(
			actor,
			new FakeFollowerRepository(repoFollowers),
			makeResourceController(),
			new ChoiceGroupControllerFactory(actor),
		);
		return { actor, cf };
	}

	const CREW = new Follower({
		slug: "crew", name: "Crew",
		hp: { value: 6, max: 6 }, armor: "0", damage: "d6",
	});
	const grantedItem = (slug, by) => {
		const it = makeFollowerItem({ slug }, { owned: true });
		it.flags = { stonetop: { grant: { source: `playbook:${by}`, key: `follower:${slug}` } } };
		return it;
	};

	it("embeds the playbook's listed followers as owned, stamped with the playbook that granted them", async () => {
		const { actor, cf } = setup([CREW]);
		await new GrantedItems(actor).sync(await cf.playbookGrants("the-marshal", ["crew"]));
		const item = actor.createdDocs.find(d => d.system?.slug === "crew");
		expect(item).toBeDefined();
		expect(item.system.owned).toBe(true);
		expect(item.flags?.stonetop?.grant).toEqual({ source: "playbook:the-marshal", key: "follower:crew" });
	});

	it("does not duplicate an already-embedded granted follower", async () => {
		const { actor, cf } = setup([CREW]);
		actor.items.push(grantedItem("crew", "the-marshal"));
		await new GrantedItems(actor).sync(await cf.playbookGrants("the-marshal", ["crew"]));
		expect(actor.createdDocs.filter(d => d.system?.slug === "crew")).toHaveLength(0);
	});

	// A follower this playbook no longer lists goes; the PREVIOUS playbook's followers go when that
	// playbook item is deleted (revoke), not when the next one is applied.
	it("removes a follower it granted that the playbook no longer lists", async () => {
		const ASTOR = new Follower({ slug: "astor", name: "Astor", hp: { value: 4, max: 4 }, armor: "0", damage: "d4" });
		const { actor, cf } = setup([ASTOR]);
		actor.items.push(grantedItem("crew", "the-marshal"));
		await new GrantedItems(actor).sync(await cf.playbookGrants("the-marshal", ["astor"]));
		expect([...actor.items].some(i => i.system?.slug === "crew")).toBe(false);
		expect([...actor.items].some(i => i.system?.slug === "astor")).toBe(true);
	});

	it("leaves another playbook's followers to that playbook's revoke", async () => {
		const { actor, cf } = setup([CREW]);
		actor.items.push(grantedItem("crew", "the-marshal"));
		await new GrantedItems(actor).sync(await cf.playbookGrants("the-blessed", ["crew"]));
		expect([...actor.items].some(i => i.system?.slug === "crew")).toBe(true);
	});

	it("leaves manual followers (no grant marker) untouched", async () => {
		const { actor, cf } = setup([]);
		actor.items.push(makeFollowerItem({ slug: "enfys" }, { owned: true }));
		await new GrantedItems(actor).sync(await cf.playbookGrants("the-marshal", ["crew"]));
		expect([...actor.items].some(i => i.system?.slug === "enfys")).toBe(true);
	});
});

// -- toggleSelection ----------------------------------------------------------------

describe("CharacterFollowers.toggleSelection", () => {
	function setup(itemTags) {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "crew" }, { owned: true }));
		cf._actor.items.get("crew-item").system.tagList = itemTags;
		return cf;
	}

	it("adds a tag that isn't selected and reflects it as a selected chip", async () => {
		const cf = setup({ selected: ["group"], options: ["group", "archers"], multi: true, allowCustom: true });
		await cf.toggleSelection("crew", "tagList", "archers");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tagSelection.has("archers")).toBe(true);
		expect(snap.isGroup).toBe(true);
	});

	it("removes a tag that is already selected", async () => {
		const cf = setup({ selected: ["group", "archers"], options: ["group", "archers"], multi: true, allowCustom: true });
		await cf.toggleSelection("crew", "tagList", "archers");
		const [snap] = await cf.buildSnapshot();
		expect(snap.tagSelection.has("archers")).toBe(false);
	});

	it("single-select instinct replaces the previous pick", async () => {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "crew" }, { owned: true }));
		cf._actor.items.get("crew-item").system.instinct =
			{ selected: ["to lord over others"], options: ["to lord over others", "to take needless risks"], multi: false, allowCustom: true };
		await cf.toggleSelection("crew", "instinct", "to take needless risks");
		const [snap] = await cf.buildSnapshot();
		expect(snap.instinctSelection.values).toEqual(["to take needless risks"]);
		expect(snap.instinct).toBe("to take needless risks");
	});
});

// -- Regression: an unrelated edit must not wipe a follower's global tagList ----------
// Foundry re-runs migrateData on the partial {changed-keys} update diff; a migration that
// default-injects an absent field clobbers the stored value on every edit. FakeActor mirrors
// that re-run, so these fail if migrateCreatureData ever defaults an absent tagList/instinct
// again. See migrate-data-runs-on-update-diff.md.
describe("CharacterFollowers — an edit keeps the global tagList (migrate-on-diff guard)", () => {
	function makeCrew() {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem(
			{ slug: "crew", members: [{ name: "Aedith", hp: { value: 6, max: 6 } }] }, { owned: true }));
		cf._actor.items.get("crew-item").system.tagList =
			{ selected: ["group"], options: ["group", "archers"], multi: true, allowCustom: true };
		return cf;
	}
	const groupTag = cf => cf._actor.items.get("crew-item").system.tagList.selected;

	it("survives an armor edit", async () => {
		const cf = makeCrew();
		await cf.setArmor("crew", "2 (shields)");
		expect(groupTag(cf)).toEqual(["group"]);
	});

	it("survives adding a member", async () => {
		const cf = makeCrew();
		await cf.addMember("crew");
		expect(groupTag(cf)).toEqual(["group"]);
	});
});

// -- Animal companion (Ranger) -------------------------------------------------
describe("CharacterFollowers — animal companion", () => {
	const BIRD = {
		slug: "bird", name: "bird", variants: ["falcon"],
		hp: { value: 5, max: 5 }, armor: "1 (size)", damage: "d4 (hand)",
		pickCount: 4,
		options: ["+4 HP", "fast", "tiny", "__"], defaults: ["tiny"],
	};
	function makeCompanion() {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "comp" }, { owned: true }));
		cf._actor.items.get("comp-item").system.companion = {
			enabled: true,
			type:    { selected: [], options: [], multi: false, allowCustom: true },
			options: { selected: [], options: [], multi: true, allowCustom: true },
			catalog: [BIRD],
		};
		return cf;
	}
	const sysOf = cf => cf._actor.items.get("comp-item").system;

	it("setCompanionType pre-fills hp/armor/damage and resets the options pool + defaults", async () => {
		const cf = makeCompanion();
		await cf.setCompanionType("comp", "bird");
		const sys = sysOf(cf);
		expect(sys.hp).toEqual({ value: 5, max: 5 });
		expect(sys.armor).toBe("1 (size)");
		expect(sys.damage).toBe("d4 (hand)");
		expect(sys.companion.type.selected).toEqual(["bird"]);
		expect(sys.companion.options.options).toEqual(["+4 HP", "fast", "tiny", "__"]);
		expect(sys.companion.options.selected).toEqual(["tiny"]);
	});

	it("toggleCompanionOption adds and removes within the pool (whole object written back)", async () => {
		const cf = makeCompanion();
		await cf.setCompanionType("comp", "bird");
		await cf.toggleCompanionOption("comp", "fast");
		expect(sysOf(cf).companion.options.selected).toEqual(["tiny", "fast"]);
		await cf.toggleCompanionOption("comp", "tiny");
		expect(sysOf(cf).companion.options.selected).toEqual(["fast"]);
		// the catalog + enabled flag survive option edits
		expect(sysOf(cf).companion.enabled).toBe(true);
		expect(sysOf(cf).companion.catalog).toHaveLength(1);
	});

	it("editing armor keeps the companion type/options intact (migrate-on-diff guard)", async () => {
		const cf = makeCompanion();
		await cf.setCompanionType("comp", "bird");
		await cf.setArmor("comp", "2");
		const c = sysOf(cf).companion;
		expect(c.type.selected).toEqual(["bird"]);
		expect(c.options.selected).toEqual(["tiny"]);
		expect(c.enabled).toBe(true);
	});

	it("buildSnapshot exposes isCompanion + type options from the catalog + pickCount", async () => {
		const cf = makeCompanion();
		await cf.setCompanionType("comp", "bird");
		const [snap] = await cf.buildSnapshot();
		expect(snap.isCompanion).toBe(true);
		expect(snap.companionTypeSelection.values).toEqual(["bird"]);
		expect(snap.companionTypeSelection.options).toContain("bird");
		expect(snap.companionOptionsSelection.multi).toBe(true);
		expect(snap.companionPickCount).toBe(4);
		expect(snap.companionStartOptions).toEqual(["tiny"]); // the "(start with …)" defaults
	});

	it("a non-companion follower reports isCompanion false", async () => {
		const cf = makeCf(new FakeFollowerRepository([]));
		cf._actor.items.push(makeFollowerItem({ slug: "enfys" }, { owned: true }));
		const [snap] = await cf.buildSnapshot();
		expect(snap.isCompanion).toBe(false);
	});

	it("the Type dropdown lists the catalog even before a type is picked", async () => {
		const cf = makeCompanion(); // no setCompanionType yet
		const [snap] = await cf.buildSnapshot();
		expect(snap.companionTypeSelection.options).toEqual(["bird"]);
		expect(snap.companionTypeSelection.values).toEqual([]);
	});
});

// -- Tests: follower inventory (shared outfit catalog) ------------------------

const OUTFIT = [
	{ slug: "hatchet", name: "Hatchet, iron", weight: 1, tags: "hand, thrown", note: "x piercing", inventoryColumn: "regular", group: "Weapons" },
	{ slug: "shield",  name: "Shield",        weight: 2, tags: "",             note: null,          inventoryColumn: "regular", group: "Armor" },
	{ slug: "hides",   name: "Thick hides",   weight: 2, tags: "",             note: "1 armor",     inventoryColumn: "regular", group: "Armor" },
	{ slug: "pack",    name: "Pack",          weight: 3, tags: "",             note: null,          inventoryColumn: "regular", group: "Travel" },
	{ slug: "torch",   name: "Torch",         weight: 1, tags: "",             note: null,          inventoryColumn: "small",   group: "Sundries" },
];
const FOLLOWER_TMPL = new Follower({ slug: "crew", name: "Crew", hp: { value: 6, max: 6 } });
const FOLLOWER_TMPL_2 = new Follower({ slug: "enfys", name: "Enfys", hp: { value: 4, max: 4 } });

function makeCfInv(invItems = OUTFIT) {
	const actor = makeActor();
	const cf = new CharacterFollowers(
		actor, new FakeFollowerRepository([FOLLOWER_TMPL, FOLLOWER_TMPL_2]), makeResourceController(),
		new ChoiceGroupControllerFactory(actor), { getAll: async () => invItems },
	);
	return cf;
}

const ownedSlugs = inv => inv.ownedSections.flatMap(s => s.items.map(i => i.slug));

describe("CharacterFollowers — inventory", () => {
	it("setInvItemChecked is reflected in the inventory snapshot owned subset", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		await cf.setInvItemChecked("crew", "hatchet", true);
		const [snap] = await cf.buildSnapshot();
		expect(ownedSlugs(snap.inventory)).toEqual(["hatchet"]);
		expect(snap.inventory.hasAny).toBe(true);
	});

	it("the full catalog is built ONLY when this follower's inventory is open (perf)", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		await cf.setInvItemChecked("crew", "hatchet", true);

		let [snap] = await cf.buildSnapshot();           // closed by default
		expect(snap.inventory.editing).toBe(false);
		expect(snap.inventory.sections).toEqual([]);      // no catalog DOM for a closed follower

		cf.setOpenInventories(["crew"]);
		[snap] = await cf.buildSnapshot();                // expanded
		expect(snap.inventory.editing).toBe(true);
		const catalogSlugs = snap.inventory.sections.flatMap(s => s.items.map(i => i.slug));
		expect(catalogSlugs).toEqual(expect.arrayContaining(["hatchet", "shield", "hides", "pack"]));
		expect(catalogSlugs).not.toContain("torch");      // "small" items excluded
	});

	it("checking gear on one follower does NOT affect another follower", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		await cf.addFollower("enfys");
		await cf.setInvItemChecked("crew", "hatchet", true);
		const snaps = await cf.buildSnapshot();
		const byName = Object.fromEntries(snaps.map(s => [s.name, s]));
		expect(ownedSlugs(byName.Crew.inventory)).toEqual(["hatchet"]);
		expect(ownedSlugs(byName.Enfys.inventory)).toEqual([]); // isolated
	});

	it("unchecking removes the item from the owned subset", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		await cf.setInvItemChecked("crew", "hatchet", true);
		await cf.setInvItemChecked("crew", "hatchet", false);
		const [snap] = await cf.buildSnapshot();
		expect(ownedSlugs(snap.inventory)).toEqual([]);
		expect(snap.inventory.hasAny).toBe(false);
	});

	it("custom items: add → held + appears in catalog; remove → gone", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		await cf.addInvCustomItem("crew", "Lucky charm", 1);
		cf.setOpenInventories(["crew"]);
		let [snap] = await cf.buildSnapshot();
		const custom = snap.inventory.sections.flatMap(s => s.items).find(i => i.name === "Lucky charm");
		expect(custom).toBeTruthy();
		expect(custom.isCustom).toBe(true);       // deletable
		expect(custom.checked).toBe(true);        // auto-held on add
		expect(ownedSlugs(snap.inventory)).toContain(custom.slug);

		await cf.removeInvCustomItem("crew", custom.slug);
		[snap] = await cf.buildSnapshot();
		expect(snap.inventory.sections.flatMap(s => s.items).some(i => i.name === "Lucky charm")).toBe(false);
	});

	it("setInvResource is reflected in the item's resource snapshot", async () => {
		const cf = makeCfInv([{ slug: "bow", name: "Bow", weight: 1, inventoryColumn: "regular", group: "Weapons", resource: { max: 2, title: null, labels: [] } }]);
		await cf.addFollower("crew");
		await cf.setInvItemChecked("crew", "bow", true);
		await cf.setInvResource("crew", "bow", 1);
		cf.setOpenInventories(["crew"]);
		const [snap] = await cf.buildSnapshot();
		const bow = snap.inventory.sections.flatMap(s => s.items).find(i => i.slug === "bow");
		expect(bow.resource.current).toBe(1);
	});

	it("computes total weight and an informational load band from checked items", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		await cf.setInvItemChecked("crew", "hatchet", true); // 1 → light
		let [snap] = await cf.buildSnapshot();
		expect(snap.inventory.totalWeight).toBe(1);
		expect(snap.inventory.band).toBe("light");
		await cf.setInvItemChecked("crew", "shield", true);  // +2
		await cf.setInvItemChecked("crew", "hides", true);   // +2 → 5 → normal
		[snap] = await cf.buildSnapshot();
		expect(snap.inventory.totalWeight).toBe(5);
		expect(snap.inventory.band).toBe("normal");
		expect(snap.inventory.loadNormal).toBe(true);
	});

	it("checking past Heavy is allowed — load is guidance, never a cap", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		for (const s of ["hatchet", "shield", "hides", "pack"]) await cf.setInvItemChecked("crew", s, true);
		const [snap] = await cf.buildSnapshot();
		expect(snap.inventory.totalWeight).toBe(8); // 1+2+2+3, over the 7+ threshold
		expect(snap.inventory.band).toBe("heavy");
		expect(snap.inventory.loadHeavy).toBe(true);
	});

	it("flags a follower carrying more than their capacity, without stopping them", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		await cf.setLoadCapacity("crew", 4);

		await cf.setInvItemChecked("crew", "pack", true);     // 3 of 4
		let [snap] = await cf.buildSnapshot();
		expect(snap.inventory.capacity).toBe(4);
		expect(snap.inventory.overCapacity).toBe(false);

		await cf.setInvItemChecked("crew", "shield", true);   // 5 of 4
		[snap] = await cf.buildSnapshot();
		expect(snap.inventory.totalWeight).toBe(5);
		expect(snap.inventory.overCapacity).toBe(true);
		expect(ownedSlugs(snap.inventory)).toEqual(["shield", "pack"]); // still held — guidance only
	});

	it("defaults a follower's capacity to the 9 ◇ the Outfit move tops out at", async () => {
		const cf = makeCfInv();
		await cf.addFollower("crew");
		const [snap] = await cf.buildSnapshot();
		expect(snap.inventory.capacity).toBe(9);
		expect(snap.inventory.overCapacity).toBe(false);
	});

	it("inventory is null when no outfit catalog is wired (no inventory repo)", async () => {
		const cf = makeCf(new FakeFollowerRepository([FOLLOWER_TMPL])); // 4-arg ctor, no inv repo
		await cf.addFollower("crew");
		const [snap] = await cf.buildSnapshot();
		expect(snap.inventory).toBeNull();
		expect(snap.hasInventory).toBe(false);
	});
});

// Characterization net for the deferred FollowerItem extraction. The nine single-field setters are
// nine copies of "find the item, updateEmbeddedDocuments one key"; replacing them with an entity
// carrying `with`-methods must not change either property asserted here — a setter reaches only its
// own field, and reaching it leaves every sibling alone.
describe("CharacterFollowers — single-field setters are independent", () => {
	async function ownedEnfys() {
		const cf = makeCf(new FakeFollowerRepository([ENFYS]));
		await cf.addFollower("enfys");
		return cf;
	}

	const snap = async cf => (await cf.buildSnapshot())[0];

	it("writes each single-line field without disturbing the others", async () => {
		const cf = await ownedEnfys();

		await cf.setArmor("enfys", "1 (hide)");
		await cf.setDamage("enfys", "d6");
		await cf.setInstinct("enfys", "to protect");
		await cf.setCost("enfys", "a warm bed");
		await cf.setName("enfys", "Enfys the Bold");

		const s = await snap(cf);
		expect(s.armor.raw).toBe("1 (hide)");
		expect(s.damage.raw).toBe("d6");
		expect(s.instinct).toBe("to protect");
		expect(s.cost).toBe("a warm bed");
		expect(s.name).toBe("Enfys the Bold");
	});

	it("writes each free-text field without disturbing the others", async () => {
		const cf = await ownedEnfys();

		await cf.setMoves("enfys", "- Bite d6");
		await cf.setNotes("enfys", "owes a debt");
		await cf.setSpecialQuality("enfys", "keen-eyed");
		await cf.setDescription("enfys", "a slight figure");

		const s = await snap(cf);
		expect(s.moves.raw).toBe("- Bite d6");
		expect(s.notes.raw).toBe("owes a debt");
		expect(s.specialQuality.raw).toBe("keen-eyed");
		expect(s.description.raw).toBe("a slight figure");
	});

	// The setters write `system: { field }` and Foundry MERGES, so an edit must never drop the
	// fields it left out — the property that makes nine separate writers safe today.
	it("leaves the fields it was not given untouched", async () => {
		const cf = await ownedEnfys();
		const before = await snap(cf);

		await cf.setArmor("enfys", "2 (shield)");

		const after = await snap(cf);
		expect(after.damage.raw).toBe(before.damage.raw);
		expect(after.instinct).toBe(before.instinct);
		expect(after.moves.raw).toBe(before.moves.raw);
		expect(after.name).toBe(before.name);
		expect(after.hp).toBe(before.hp);
		expect(after.hpMax).toBe(before.hpMax);
	});

	it("keeps HP current and max independent of one another", async () => {
		const cf = await ownedEnfys();

		await cf.setHpMax("enfys", 9);
		await cf.setHp("enfys", 4);

		const s = await snap(cf);
		expect(s.hpMax).toBe(9);
		expect(s.hp).toBe(4);
	});

	it("does nothing for a slug no owned follower answers to", async () => {
		const cf = await ownedEnfys();

		await expect(cf.setArmor("nobody", "3")).resolves.not.toThrow();

		expect((await snap(cf)).armor.raw).toBe("");
	});
});
