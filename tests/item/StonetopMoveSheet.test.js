import { describe, it, expect } from "vitest";
import { buildMoveUpdate } from "../../module/item/StonetopMoveSheet.js";

describe("buildMoveUpdate", () => {
	it("assembles core fields and coerces numbers/booleans", () => {
		const u = buildMoveUpdate({
			name: "Clash",
			"system.moveType": "basic",
			"system.rollType": "str",
			"system.description": "<p>When you fight…</p>",
			"system.playbook": "",
			"system.slug": "clash",
			"system.repeatMax": "0",
			"system.isStartingMove": false,
			"system.noXpOnMiss": true,
			"system.weight": "1",
			"system.inventoryColumn": "regular",
			"system.armorBonus": "0",
			"system.hpBonus": "0",
		});
		expect(u.name).toBe("Clash");
		expect(u.system.moveType).toBe("basic");
		expect(u.system.rollType).toBe("str");
		expect(u.system.repeatMax).toBe(0);
		expect(u.system.noXpOnMiss).toBe(true);
		expect(u.system.isStartingMove).toBe(false);
		expect(u.system.weight).toBe(1);
	});

	it("keeps only the filled move-result boxes and defaults their label", () => {
		const u = buildMoveUpdate({
			name: "X",
			"system.moveResults.success.label": "10+",
			"system.moveResults.success.value": "It works.",
			"system.moveResults.partial.label": "7-9",
			"system.moveResults.partial.value": "",
			"system.moveResults.failure.label": "",
			"system.moveResults.failure.value": "It fails badly.",
		});
		expect(u.system.moveResults).toEqual({
			success: { label: "10+", value: "It works." },
			failure: { label: "6-", value: "It fails badly." }, // label defaulted
		});
		expect(u.system.moveResults.partial).toBeUndefined();
	});

	it("nulls moveResults / requirement / resource when entirely empty", () => {
		const u = buildMoveUpdate({ name: "X", _reqMoves: "  \n  " });
		expect(u.system.moveResults).toBeNull();
		expect(u.system.requirement).toBeNull();
		expect(u.system.resource).toBeNull();
	});

	it("parses required moves from newline text and the level/playbook gate", () => {
		const u = buildMoveUpdate({
			name: "X",
			_reqMoves: "Spirit Tongue\n  Borrow Power  \n\n",
			"system.requirement.level": "3",
			"system.requirement.playbook": " The Blessed ",
		});
		expect(u.system.requirement).toEqual({
			moves: ["Spirit Tongue", "Borrow Power"],
			level: 3,
			playbook: "The Blessed",
		});
	});

	it("builds a resource track from title + max, and ignores an empty max alone", () => {
		expect(buildMoveUpdate({ name: "X", "system.resource.title": "Favor", "system.resource.max": "4" }).system.resource)
			.toEqual({ title: "Favor", max: 4 });
		expect(buildMoveUpdate({ name: "X", "system.resource.title": "", "system.resource.max": "" }).system.resource)
			.toBeNull();
	});

	it("only writes managed fields (leaves asterisk/markOptions untouched for the merge)", () => {
		const u = buildMoveUpdate({ name: "X" });
		expect(u.system).not.toHaveProperty("asterisk");
		expect(u.system).not.toHaveProperty("markOptions");
		expect(u.system).not.toHaveProperty("loadBonus");
	});

	it("carries img through only when present", () => {
		expect(buildMoveUpdate({ name: "X", img: "icons/x.png" }).img).toBe("icons/x.png");
		expect(buildMoveUpdate({ name: "X" })).not.toHaveProperty("img");
	});
});
