import { describe, it, expect } from "vitest";
import { ChoiceGroupController } from "../../../module/actors/character/ChoiceGroupController.js";
import { StonetopFlags } from "../../../module/actors/character/StonetopFlags.js";
import { ChoiceGroup } from "../../../module/model/snapshot/character/ChoiceGroup.js";
import { FakeFlags } from "../../fakes/FakeFlags.js";

function makeController(stored = {}) {
	const actor = new FakeFlags();
	for (const [key, value] of Object.entries(stored)) {
		actor.setFlagNonAsync("stonetop", `appearance.${key}`, value);
	}
	const flags = new StonetopFlags(actor, "appearance");
	return new ChoiceGroupController(flags);
}

const GROUP_DATA = {
	slug: "appearance",
	list: [{
		type: "pick",
		pickCount: 1,
		inline: true,
		options: [
			{ slug: "tall",  text: "tall" },
			{ slug: "short", text: "short" },
		],
	}],
};

// -- selectOption -------------------------------------------------------------

describe("ChoiceGroupController — selectOption", () => {
	it("stores the chosen slug under the given groupSlug", async () => {
		const ctrl = makeController();
		await ctrl.selectOption("appearance", "tall", "tall,short");
		expect(ctrl._flags.getFlag("values").appearance.tall).toBe(1);
	});

	it("zeroes sibling slugs before setting the chosen one", async () => {
		const ctrl = makeController();
		await ctrl.selectOption("appearance", "tall", "tall,short");
		expect(ctrl._flags.getFlag("values").appearance.short).toBe(0);
	});

	it("handles absent siblingSlugsCsv without error", async () => {
		const ctrl = makeController();
		await ctrl.selectOption("appearance", "tall", undefined);
		expect(ctrl._flags.getFlag("values").appearance.tall).toBe(1);
	});
});

// -- clearValues --------------------------------------------------------------

describe("ChoiceGroupController — clearValues", () => {
	it("resets the values flag to an empty object", async () => {
		const ctrl = makeController({ values: { appearance: { tall: 1 } } });
		await ctrl.clearValues();
		expect(ctrl._flags.getFlag("values")).toEqual({});
	});
});

// -- buildGroup ---------------------------------------------------------------

describe("ChoiceGroupController — buildGroup", () => {
	it("returns a ChoiceGroup instance", () => {
		expect(makeController().buildGroup(GROUP_DATA)).toBeInstanceOf(ChoiceGroup);
	});

	it("group contains the options from pack data", () => {
		const group = makeController().buildGroup(GROUP_DATA);
		expect(group.list[0].options).toHaveLength(2);
		expect(group.list[0].options[0].slug).toBe("tall");
		expect(group.list[0].options[1].slug).toBe("short");
	});

	it("marks the saved option as checked", () => {
		const ctrl = makeController({ values: { appearance: { tall: 1 } } });
		const group = ctrl.buildGroup(GROUP_DATA);
		expect(group.list[0].options[0].checked).toBe(true);
		expect(group.list[0].options[1].checked).toBe(false);
	});

	it("no option is checked when nothing is saved", () => {
		const group = makeController().buildGroup(GROUP_DATA);
		expect(group.list[0].options.every(o => !o.checked)).toBe(true);
	});
});
