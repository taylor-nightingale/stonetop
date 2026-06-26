import { describe, it, expect, vi } from "vitest";
import { Selection } from "../../../module/model/Selection.js";
import { NpcSnapshotBuilder } from "../../../module/model/NpcSnapshot.js";
import { StonetopNpc } from "../../../module/actors/npc/StonetopNpc.js";

function fakeNpcActor(system = {}) {
	return {
		id: "npc1",
		type: "npc",
		system,
		update: vi.fn(async () => {}),
	};
}

describe("Selection", () => {
	it("parses a legacy comma string as a multi selection", () => {
		const sel = Selection.fromStored("group, intelligent", { multi: true });
		expect(sel.values).toEqual(["group", "intelligent"]);
		expect(sel.has("group")).toBe(true);
		expect(sel.text).toBe("group, intelligent");
	});

	it("keeps a single-select string whole (commas included)", () => {
		const sel = Selection.fromStored("protect the grove, at any cost", { multi: false });
		expect(sel.values).toEqual(["protect the grove, at any cost"]);
	});

	it("round-trips a stored object via toRaw", () => {
		const raw = { selected: ["a"], options: ["a", "b"], multi: true, allowCustom: true };
		expect(Selection.fromStored(raw).toRaw()).toEqual(raw);
	});

	it("toggle adds/removes for multi and replaces for single (immutably)", () => {
		const multi = Selection.multi(["a"], { options: ["a", "b"] });
		expect(multi.toggle("b").values).toEqual(["a", "b"]);
		expect(multi.toggle("a").values).toEqual([]);
		expect(multi.values).toEqual(["a"]); // original untouched

		const single = Selection.single("a", { options: ["a", "b"] });
		expect(single.toggle("b").values).toEqual(["b"]);
		expect(single.toggle("a").values).toEqual([]);
	});

	it("exposes unselected options as add-suggestions", () => {
		const sel = Selection.multi(["a"], { options: ["a", "b", "c"] });
		expect(sel.unselectedOptions).toEqual(["b", "c"]);
	});
});

describe("NpcSnapshot", () => {
	it("builds queryable tag/instinct selections and an isGroup flag", () => {
		const snap = new NpcSnapshotBuilder()
			.withHp(4).withHpMax(6)
			.withArmor("1").withDamage("d8")
			.withTags("group, undead").withInstinct("hunger")
			.withSpecialQuality("regenerates").withMoves("- Lurch forward")
			.withDescription("A shambling mass.")
			.build();

		expect(snap.hp).toBe(4);
		expect(snap.hpMax).toBe(6);
		expect(snap.tagSelection.has("group")).toBe(true);
		expect(snap.isGroup).toBe(true);
		expect(snap.instinct).toBe("hunger");
		expect(snap.instinctSelection.multi).toBe(false);
	});
});

describe("StonetopNpc", () => {
	it("reads stat-block values from system", () => {
		const npc = new StonetopNpc(fakeNpcActor({
			hp: { value: 3, max: 5 },
			armor: "2",
			damage: "d6",
			specialQuality: "flies",
			instinct: { selected: ["to feed"], options: [], multi: false, allowCustom: true },
			tagList: { selected: ["beast"], options: [], multi: true, allowCustom: true },
			moves: "- Swoop",
			description: "A winged horror.",
		}));
		expect(npc.hp).toBe(3);
		expect(npc.maxHp).toBe(5);
		expect(npc.armor).toBe("2");
		expect(npc.instinct).toBe("to feed");
		expect(npc.tags).toBe("beast");
	});

	it("writes setters to the right system paths", async () => {
		const actor = fakeNpcActor({});
		const npc = new StonetopNpc(actor);
		await npc.setHp("7");
		expect(actor.update).toHaveBeenCalledWith({ "system.hp.value": 7 });
		await npc.setArmor("3 (resilience)");
		expect(actor.update).toHaveBeenCalledWith({ "system.armor": "3 (resilience)" });
	});

	it("toggleSelection adds a tag (multi) and sets instinct (single)", async () => {
		const actor = fakeNpcActor({
			tagList: { selected: ["beast"], options: [], multi: true, allowCustom: true },
			instinct: { selected: [], options: [], multi: false, allowCustom: true },
		});
		const npc = new StonetopNpc(actor);

		await npc.toggleSelection("tagList", "group");
		expect(actor.update).toHaveBeenCalledWith({
			"system.tagList": expect.objectContaining({ selected: ["beast", "group"], multi: true }),
		});

		await npc.toggleSelection("instinct", "to feed");
		expect(actor.update).toHaveBeenCalledWith({
			"system.instinct": expect.objectContaining({ selected: ["to feed"], multi: false }),
		});
	});

	it("renders newline move lines as an enriched <ul> in the snapshot", async () => {
		const npc = new StonetopNpc(fakeNpcActor({ moves: "- Lurch\n- Grab\n   plain line" }));
		const snap = await npc.buildSnapshot();
		expect(snap.movesHtml).toBe("<ul><li>Lurch</li><li>Grab</li><li>plain line</li></ul>");
	});

	it("buildSnapshot returns empty moves html when there are no moves", async () => {
		const npc = new StonetopNpc(fakeNpcActor({ moves: "" }));
		const snap = await npc.buildSnapshot();
		expect(snap.movesHtml).toBe("");
	});
});
