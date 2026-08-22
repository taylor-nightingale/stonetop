import { describe, it, expect } from "vitest";
import { SheetSizeMemory } from "../../src/utils/SheetSizeMemory.js";
import { SheetSize } from "../../src/utils/SheetSize.js";
import { RememberedSize } from "../../src/utils/RememberedSize.js";

// A fake for the injected client-setting backing.
function fakeBacking(initial = {}) {
	let stored = initial;
	return {
		read: () => stored,
		write: (map) => { stored = map; },
		peek: () => stored,
	};
}

describe("SheetSizeMemory", () => {
	it("returns null for an unknown key", () => {
		const memory = new SheetSizeMemory(fakeBacking());
		expect(memory.get("Actor.character")).toBeNull();
	});

	it("stores and retrieves a size, with the setting it was chosen at", () => {
		const memory = new SheetSizeMemory(fakeBacking());
		memory.set("Actor.character", new RememberedSize(new SheetSize(1000, 700), 32));

		const got = memory.get("Actor.character");
		expect(got).toBeInstanceOf(RememberedSize);
		expect(got.size.toObject()).toEqual({ width: 1000, height: 700 });
		expect(got.rootFontSizePx).toBe(32);
	});

	it("still reads an entry stored before the setting was recorded", () => {
		const memory = new SheetSizeMemory(fakeBacking({ "Actor.character": { width: 1000, height: 700 } }));
		const got = memory.get("Actor.character");
		expect(got.size.toObject()).toEqual({ width: 1000, height: 700 });
		expect(got.isConvertible).toBe(false);
	});

	it("keeps sizes for other keys untouched when setting one", () => {
		const backing = fakeBacking({ "Item.follower": { width: 940, height: 760, rootFontSizePx: 16 } });
		const memory = new SheetSizeMemory(backing);

		memory.set("Actor.character", new RememberedSize(new SheetSize(1000, 700), 32));

		expect(memory.get("Item.follower").size.toObject()).toEqual({ width: 940, height: 760 });
		expect(memory.get("Actor.character").size.toObject()).toEqual({ width: 1000, height: 700 });
	});

	it("persists plain objects (not class instances) into the backing", () => {
		const backing = fakeBacking();
		const memory = new SheetSizeMemory(backing);
		memory.set("Actor.character", new RememberedSize(new SheetSize(1000, 700), 32));
		expect(backing.peek()).toEqual({ "Actor.character": { width: 1000, height: 700, rootFontSizePx: 32 } });
	});

	it("returns null when the stored value is invalid", () => {
		const memory = new SheetSizeMemory(fakeBacking({ "Actor.character": { width: "auto", height: 700 } }));
		expect(memory.get("Actor.character")).toBeNull();
	});
});
