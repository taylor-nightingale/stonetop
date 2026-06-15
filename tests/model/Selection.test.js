import { describe, it, expect } from "vitest";
import { Selection } from "../../src/model/data/Selection.js";

describe("Selection.single", () => {
	it("exposes the chosen value", () => {
		const s = Selection.single("to feed", { options: ["to feed", "to flee"] });
		expect(s.value).toBe("to feed");
		expect(s.values).toEqual(["to feed"]);
		expect(s.multi).toBe(false);
		expect(s.has("to feed")).toBe(true);
	});

	it("is empty for null/blank", () => {
		expect(Selection.single(null).isEmpty).toBe(true);
		expect(Selection.single("").value).toBeNull();
	});

	it("toggle sets the value, and toggling the same value clears it", () => {
		const s = Selection.single(null, { options: ["a", "b"] });
		const a = s.toggle("a");
		expect(a.value).toBe("a");
		expect(a.toggle("b").value).toBe("b");   // single-select replaces
		expect(a.toggle("a").isEmpty).toBe(true); // toggling current clears
	});
});

describe("Selection.multi", () => {
	it("exposes all selected values and membership", () => {
		const s = Selection.multi(["group", "archers"], { options: ["group", "archers", "stealthy"] });
		expect(s.values).toEqual(["group", "archers"]);
		expect(s.has("group")).toBe(true);
		expect(s.has("stealthy")).toBe(false);
	});

	it("toggle adds and removes without touching others", () => {
		const s = Selection.multi(["group"]);
		const added = s.toggle("stealthy");
		expect(added.values).toEqual(["group", "stealthy"]);
		expect(added.toggle("group").values).toEqual(["stealthy"]);
	});
});

describe("Selection.fromStored + text", () => {
	it("parses a legacy comma string into a multi selection", () => {
		const s = Selection.fromStored("Bird-wise, innocent");
		expect(s.values).toEqual(["Bird-wise", "innocent"]);
		expect(s.multi).toBe(true);
		expect(s.text).toBe("Bird-wise, innocent");
	});

	it("passes a structured object through", () => {
		const s = Selection.fromStored({ selected: ["group"], options: ["group", "archers"], multi: true, allowCustom: true });
		expect(s.values).toEqual(["group"]);
		expect(s.options).toEqual(["group", "archers"]);
	});

	it("returns an empty selection for null/undefined", () => {
		expect(Selection.fromStored(null).isEmpty).toBe(true);
		expect(Selection.fromStored(undefined).values).toEqual([]);
	});

	it("single-select keeps the whole string (does not split on commas)", () => {
		const s = Selection.fromStored("to feed, then flee", { multi: false });
		expect(s.values).toEqual(["to feed, then flee"]);
		expect(s.multi).toBe(false);
	});

	it("text round-trips a legacy string", () => {
		expect(Selection.fromStored("fae, woodland").text).toBe("fae, woodland");
	});
});

describe("Selection.unselectedOptions", () => {
	it("returns options not yet selected (for the add dropdown)", () => {
		const s = Selection.multi(["group"], { options: ["group", "archers", "stealthy"] });
		expect(s.unselectedOptions).toEqual(["archers", "stealthy"]);
	});
});

describe("Selection.chips", () => {
	it("lists every option with its selected state, then custom-selected tags", () => {
		const s = Selection.multi(["group", "wise"], { options: ["group", "archers"] });
		expect(s.chips).toEqual([
			{ value: "group",   selected: true,  custom: false },
			{ value: "archers", selected: false, custom: false },
			{ value: "wise",    selected: true,  custom: true },
		]);
	});

	it("is just the selected customs when there are no options", () => {
		const s = Selection.multi(["a", "b"]);
		expect(s.chips).toEqual([
			{ value: "a", selected: true, custom: true },
			{ value: "b", selected: true, custom: true },
		]);
	});
});

describe("Selection — immutability + serialization", () => {
	it("toggle returns a new instance and leaves the original unchanged", () => {
		const s = Selection.multi(["group"]);
		const t = s.toggle("clever");
		expect(s.values).toEqual(["group"]);
		expect(t).not.toBe(s);
	});

	it("toRaw round-trips through the constructor", () => {
		const s = Selection.multi(["group"], { options: ["group", "clever"], allowCustom: false });
		const back = new Selection(s.toRaw());
		expect(back.toRaw()).toEqual(s.toRaw());
	});
});
