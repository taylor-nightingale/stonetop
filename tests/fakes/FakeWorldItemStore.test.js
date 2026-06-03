import { describe, it, expect } from "vitest";
import { FakeWorldItemStore } from "./FakeWorldItemStore.js";

describe("FakeWorldItemStore", () => {
	it("getAll returns all added items", async () => {
		const store = new FakeWorldItemStore();
		store.add({ name: "A" }).add({ name: "B" });
		expect(await store.getAll()).toHaveLength(2);
	});

	it("findEntry returns first match", async () => {
		const store = new FakeWorldItemStore();
		store.add({ name: "A" }).add({ name: "B" });
		expect((await store.findEntry(e => e.name === "B")).name).toBe("B");
	});

	it("findEntry returns null when nothing matches", async () => {
		const store = new FakeWorldItemStore();
		store.add({ name: "A" });
		expect(await store.findEntry(e => e.name === "Z")).toBeNull();
	});

	it("filterEntries returns all matches", async () => {
		const store = new FakeWorldItemStore();
		store.add({ type: "move" }).add({ type: "move" }).add({ type: "playbook" });
		expect(await store.filterEntries(e => e.type === "move")).toHaveLength(2);
	});

	it("filterEntries returns [] when nothing matches", async () => {
		const store = new FakeWorldItemStore();
		store.add({ type: "move" });
		expect(await store.filterEntries(e => e.type === "playbook")).toHaveLength(0);
	});
});

describe("FakeWorldItemStore.getDocument", () => {
	it("returns item with matching _id", async () => {
		const store = new FakeWorldItemStore();
		store.add({ _id: "abc", name: "A" });
		expect((await store.getDocument("abc")).name).toBe("A");
	});

	it("returns null when _id not found", async () => {
		const store = new FakeWorldItemStore();
		store.add({ _id: "abc", name: "A" });
		expect(await store.getDocument("zzz")).toBeNull();
	});
});
