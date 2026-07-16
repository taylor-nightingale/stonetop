import { describe, it, expect, vi } from "vitest";
import { StonetopNpc } from "../../../src/actors/npc/StonetopNpc.js";
import { FakeNpcActorBuilder } from "../../fakes/FakeNpcActorBuilder.js";

// Map test overrides onto builder methods so construction always flows through the builder — never
// poke fields onto the actor after build() (see no-direct-mutation-after-builder).
const SETTERS = {
	hp:             (b, v) => b.withHp(v.value, v.max),
	armor:          (b, v) => b.withArmor(v),
	damage:         (b, v) => b.withDamage(v),
	specialQuality: (b, v) => b.withSpecialQuality(v),
	instinct:       (b, v) => b.withInstinct(v),
	description:    (b, v) => b.withDescription(v),
	moves:          (b, v) => b.withMoves(v),
	tagList:        (b, v) => b.withTagList(v),
};

function makeActor(overrides = {}) {
	const b = new FakeNpcActorBuilder();
	for (const [key, value] of Object.entries(overrides)) SETTERS[key]?.(b, value);
	return b.build();
}

function makeNpc(overrides = {}) {
	return new StonetopNpc(makeActor(overrides));
}

describe("StonetopNpc — getters return defaults", () => {
	it("hp defaults to 0", () => expect(makeNpc().hp).toBe(0));
	it("maxHp defaults to 0", () => expect(makeNpc().maxHp).toBe(0));
	it("armor defaults to empty string", () => expect(makeNpc().armor).toBe(""));
	it("damage defaults to empty string", () => expect(makeNpc().damage).toBe(""));
	it("specialQuality defaults to empty string", () => expect(makeNpc().specialQuality).toBe(""));
	it("instinct defaults to empty string", () => expect(makeNpc().instinct).toBe(""));
	it("description defaults to empty string", () => expect(makeNpc().description).toBe(""));
});

describe("StonetopNpc — getters reflect pre-seeded system values", () => {
	it("hp returns system.hp.value", () => expect(makeNpc({ hp: { value: 8, max: 10 } }).hp).toBe(8));
	it("maxHp returns system.hp.max", () => expect(makeNpc({ hp: { value: 8, max: 10 } }).maxHp).toBe(10));
	it("armor returns the system.armor string", () => expect(makeNpc({ armor: "2 (scales)" }).armor).toBe("2 (scales)"));
	it("damage returns system.damage", () => expect(makeNpc({ damage: "jaws d12 (messy)" }).damage).toBe("jaws d12 (messy)"));
	it("specialQuality returns system.specialQuality", () => expect(makeNpc({ specialQuality: "undead" }).specialQuality).toBe("undead"));
	it("instinct returns system.instinct", () => expect(makeNpc({ instinct: "to feed" }).instinct).toBe("to feed"));
	it("description returns system.description", () => expect(makeNpc({ description: "Horrible." }).description).toBe("Horrible."));
	it("tags returns system.tagList", () => expect(makeNpc({ tagList: "fae, woodland" }).tags).toBe("fae, woodland"));
	it("moves returns system.moves", () => expect(makeNpc({ moves: "- Bite" }).moves).toBe("- Bite"));
});

describe("StonetopNpc — moves and tags in the snapshot", () => {
	it("exposes tags and moves as RichText carrying raw markdown", async () => {
		const snap = await makeNpc({ tagList: "fae", moves: "- Bite d6\n- Vanish" }).buildSnapshot();
		expect(snap.tags).toBe("fae");
		expect(snap.moves.raw).toBe("- Bite d6\n- Vanish");
	});

	// Parity with the follower card: the snapshot must carry the stored Selection's options
	// through to tagSelection so the chip UI offers the same "add from list" dropdown.
	it("preserves tag options/multi for the pill UI (same as followers)", async () => {
		const tagList = { selected: ["group"], options: ["group", "intelligent", "large"], multi: true, allowCustom: true };
		const snap = await makeNpc({ tagList }).buildSnapshot();
		expect(snap.tagSelection.multi).toBe(true);
		expect(snap.tagSelection.values).toEqual(["group"]);
		expect(snap.tagSelection.unselectedOptions).toEqual(["intelligent", "large"]);
		expect(snap.isGroup).toBe(true);
	});

	// Instinct is single-select: a comma in the value must NOT be split into two selections.
	it("keeps a comma-containing instinct as one single-select value", async () => {
		const instinct = { selected: ["to protect, no matter the cost"], options: [], multi: false, allowCustom: true };
		const snap = await makeNpc({ instinct }).buildSnapshot();
		expect(snap.instinctSelection.multi).toBe(false);
		expect(snap.instinctSelection.values).toEqual(["to protect, no matter the cost"]);
	});
});

describe("StonetopNpc — buildSnapshot wraps game text as RichText", () => {
	it("keeps damage raw with roll:true so dice become roll buttons when enriched", async () => {
		const snap = await makeNpc({ damage: "**maw** d10+2 (messy)" }).buildSnapshot();
		expect(snap.damage.raw).toBe("**maw** d10+2 (messy)");   // raw kept for editing
		expect(snap.damage.autoRoll).toBe(true);
	});

	it("wraps specialQuality (roll), description and armor as RichText", async () => {
		const snap = await makeNpc({
			specialQuality: "*blind*, tremorsense",
			description: "A **horror**.",
			armor: "4 (resilience), 0 vs. bronze",
		}).buildSnapshot();
		expect(snap.specialQuality.raw).toBe("*blind*, tremorsense");
		expect(snap.specialQuality.autoRoll).toBe(true);
		expect(snap.description.raw).toBe("A **horror**.");
		expect(snap.armor.raw).toBe("4 (resilience), 0 vs. bronze");
		expect(snap.armor.autoRoll).toBe(false);
	});
});

describe("StonetopNpc — setters update observable state", () => {
	it("setHp updates hp", async () => {
		const npc = makeNpc();
		await npc.setHp(6);
		expect(npc.hp).toBe(6);
	});

	it("setMaxHp updates maxHp", async () => {
		const npc = makeNpc();
		await npc.setMaxHp(12);
		expect(npc.maxHp).toBe(12);
	});

	it("setArmor updates armor", async () => {
		const npc = makeNpc();
		await npc.setArmor("3 (scales)");
		expect(npc.armor).toBe("3 (scales)");
	});

	it("setDamage updates damage", async () => {
		const npc = makeNpc();
		await npc.setDamage("claws d8");
		expect(npc.damage).toBe("claws d8");
	});

	it("setSpecialQuality updates specialQuality", async () => {
		const npc = makeNpc();
		await npc.setSpecialQuality("ethereal");
		expect(npc.specialQuality).toBe("ethereal");
	});

	it("setInstinct updates instinct", async () => {
		const npc = makeNpc();
		await npc.setInstinct("to stalk");
		expect(npc.instinct).toBe("to stalk");
	});

	it("setDescription updates description", async () => {
		const npc = makeNpc();
		await npc.setDescription("A shadow given form.");
		expect(npc.description).toBe("A shadow given form.");
	});
});

describe("StonetopNpc.onPreCreate — house icon for new NPCs", () => {
	// onPreCreate runs against the PENDING document (pre-persist), where updateSource is the only
	// legal write — a minimal stub models that stage better than the persisted-actor fakes.
	function pendingNpc() {
		const doc = { updateSource: vi.fn() };
		return { npc: new StonetopNpc(doc), doc };
	}
	const HOUSE_ICON = "systems/stonetop/assets/content/icons/npc.png";

	it("replaces the missing image on a blank NPC (sidebar create)", () => {
		const { npc, doc } = pendingNpc();
		npc.onPreCreate({});
		expect(doc.updateSource).toHaveBeenCalledWith({ img: HOUSE_ICON, "prototypeToken.texture.src": HOUSE_ICON });
	});

	it("replaces Foundry's generic mystery-man default", () => {
		const { npc, doc } = pendingNpc();
		npc.onPreCreate({ img: "icons/svg/mystery-man.svg" });
		expect(doc.updateSource).toHaveBeenCalledWith({ img: HOUSE_ICON, "prototypeToken.texture.src": HOUSE_ICON });
	});

	it("keeps a specific image (e.g. a dropped compendium follower)", () => {
		const { npc, doc } = pendingNpc();
		npc.onPreCreate({ img: "systems/stonetop/assets/content/followers/crew.png" });
		expect(doc.updateSource).not.toHaveBeenCalled();
	});
});
