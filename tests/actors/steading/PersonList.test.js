import { describe, it, expect } from "vitest";
import { PersonList } from "../../../module/actors/steading/PersonList.js";
import { Person } from "../../../module/actors/steading/Person.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new PersonList(new FakeActorBuilder().build(), "steading", "people");
}

describe("PersonList.buildSnapshot", () => {
	it("returns empty array by default", () => {
		expect(make().buildSnapshot()).toEqual([]);
	});

	it("returns Person instances", async () => {
		const list = make();
		await list.add(Person.blank());
		expect(list.buildSnapshot()[0]).toBeInstanceOf(Person);
	});
});

describe("PersonList.findById", () => {
	it("returns the matching Person", async () => {
		const list = make();
		await list.add(Person.blank());
		const id = list.buildSnapshot()[0].id;
		expect(list.findById(id)).toBeInstanceOf(Person);
		expect(list.findById(id).id).toBe(id);
	});

	it("returns null when id is not found", () => {
		expect(make().findById("missing")).toBeNull();
	});
});

describe("PersonList.add", () => {
	it("appends the given person", async () => {
		const list = make();
		await list.add(Person.blank());
		expect(list.buildSnapshot()).toHaveLength(1);
	});

	it("preserves existing entries", async () => {
		const list = make();
		await list.add(Person.blank());
		await list.add(Person.blank());
		expect(list.buildSnapshot()).toHaveLength(2);
	});
});

describe("PersonList.remove", () => {
	it("removes the entry with the given id", async () => {
		const list = make();
		await list.add(Person.blank());
		const id = list.buildSnapshot()[0].id;
		await list.remove(id);
		expect(list.buildSnapshot()).toHaveLength(0);
	});

	it("does not remove other entries", async () => {
		const list = make();
		await list.add(Person.blank());
		await list.add(Person.blank());
		const [first, second] = list.buildSnapshot();
		await list.remove(first.id);
		expect(list.buildSnapshot()).toHaveLength(1);
		expect(list.buildSnapshot()[0].id).toBe(second.id);
	});
});

describe("PersonList.update", () => {
	it("replaces the matching entry by id", async () => {
		const list = make();
		await list.add(Person.blank());
		const original = list.buildSnapshot()[0];
		await list.update(original.withName("Aldric"));
		expect(list.buildSnapshot()[0].name).toBe("Aldric");
	});

	it("does not affect other entries", async () => {
		const list = make();
		await list.add(Person.blank());
		await list.add(Person.blank());
		const [first, second] = list.buildSnapshot();
		await list.update(first.withName("Aldric"));
		expect(list.findById(second.id).name).toBe("");
	});

	it("preserves unmodified fields on the updated entry", async () => {
		const list = make();
		await list.add(Person.blankNeighbor());
		const original = list.buildSnapshot()[0];
		await list.update(original.withName("Maren").withHome("Marshedge"));
		const p = list.buildSnapshot()[0];
		expect(p.name).toBe("Maren");
		expect(p.home).toBe("Marshedge");
		expect(p.occupation).toBe("");
		expect(p.traits).toBe("");
	});
});
