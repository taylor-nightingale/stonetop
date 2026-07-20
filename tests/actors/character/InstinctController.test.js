import { describe, it, expect } from "vitest";
import { InstinctController } from "../../../src/actors/character/InstinctController.js";
import { ChoiceValues } from "../../../src/model/snapshot/character/ChoiceGroup.js";

// ── Fake ──────────────────────────────────────────────────────────────────────

class FakeCtrl {
	calls = [];
	async selectOption(ns, slug, siblings) { this.calls.push({ op: "selectOption", ns, slug, siblings }); }
	async setCount(ns, slug, count)        { this.calls.push({ op: "setCount",     ns, slug, count }); }
	async setText(ns, slug, value)         { this.calls.push({ op: "setText",       ns, slug, value }); }
	async clearValues(ns)                  { this.calls.push({ op: "clearValues",   ns }); }
}

function ctrl() { return new FakeCtrl(); }

// ── selectOption ──────────────────────────────────────────────────────────────

describe("InstinctController.selectOption", () => {
	it("passes the namespace it is given straight through", async () => {
		const c = ctrl();
		await new InstinctController(c).selectOption("instinct", "delight", "delight,nurture");
		expect(c.calls[0]).toEqual({ op: "selectOption", ns: "instinct", slug: "delight", siblings: "delight,nurture" });
	});

	it("clears __custom text after selecting an option", async () => {
		const c = ctrl();
		await new InstinctController(c).selectOption("instinct", "delight", "delight,nurture");
		expect(c.calls[1]).toEqual({ op: "setText", ns: "instinct", slug: "__custom", value: "" });
	});
});

// ── selectCustom ──────────────────────────────────────────────────────────────

describe("InstinctController.selectCustom", () => {
	it("clears existing values before setting custom text", async () => {
		const c = ctrl();
		await new InstinctController(c).selectCustom("instinct", "my instinct");
		expect(c.calls[0]).toEqual({ op: "clearValues", ns: "instinct" });
	});

	it("sets __custom text", async () => {
		const c = ctrl();
		await new InstinctController(c).selectCustom("instinct", "my instinct");
		expect(c.calls[1]).toEqual({ op: "setText", ns: "instinct", slug: "__custom", value: "my instinct" });
	});
});

// ── setText ───────────────────────────────────────────────────────────────────

describe("InstinctController.setText", () => {
	it("clears pick values before setting __custom text", async () => {
		const c = ctrl();
		await new InstinctController(c).setText("instinct", "__custom", "my text");
		expect(c.calls[0]).toEqual({ op: "clearValues", ns: "instinct" });
		expect(c.calls[1]).toEqual({ op: "setText", ns: "instinct", slug: "__custom", value: "my text" });
	});

	it("does not clear values when setting text on a non-custom option", async () => {
		const c = ctrl();
		await new InstinctController(c).setText("instinct", "delight", "fill-in value");
		expect(c.calls).toHaveLength(1);
		expect(c.calls[0]).toEqual({ op: "setText", ns: "instinct", slug: "delight", value: "fill-in value" });
	});
});

// ── setCount ──────────────────────────────────────────────────────────────────

// Instinct rows are picks, but the router reaches every controller through the same three methods, so
// this one has to answer setCount too rather than being a special shape the caller must know about.
describe("InstinctController.setCount", () => {
	it("forwards a count straight through", async () => {
		const c = ctrl();
		await new InstinctController(c).setCount("instinct", "delight", 1);
		expect(c.calls[0]).toEqual({ op: "setCount", ns: "instinct", slug: "delight", count: 1 });
	});
});

// ── computeSelected ───────────────────────────────────────────────────────────

describe("InstinctController.computeSelected", () => {
	function group(checkedSlug) {
		return {
			list: [{
				options: [
					{ slug: "delight", text: "Delight", description: "To find beauty.", checked: checkedSlug === "delight" },
					{ slug: "nurture", text: "Nurture", description: "To help others.", checked: checkedSlug === "nurture" },
				],
			}],
		};
	}

	it("returns 'Text — Description' when an option is checked", () => {
		const result = InstinctController.computeSelected(group("delight"), new ChoiceValues());
		expect(result).toBe("Delight — To find beauty.");
	});

	it("returns custom text when no option is checked but __custom is set", () => {
		const values = new ChoiceValues({ instinct: { __custom: "my own instinct" } });
		expect(InstinctController.computeSelected(group(null), values)).toBe("my own instinct");
	});

	it("returns null when neither option is checked nor custom text exists", () => {
		expect(InstinctController.computeSelected(group(null), new ChoiceValues())).toBeNull();
	});

	it("returns null when instinctGroup is null", () => {
		expect(InstinctController.computeSelected(null, new ChoiceValues())).toBeNull();
	});
});
