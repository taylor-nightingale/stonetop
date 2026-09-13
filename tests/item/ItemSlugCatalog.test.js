import { afterEach, describe, it, expect, vi } from "vitest";
import { ItemSlugCatalog } from "../../src/item/ItemSlugCatalog.js";
import { FakeWorldItemStore } from "../fakes/FakeWorldItemStore.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { FakePackBuilder } from "../fakes/foundry/FakePackBuilder.js";

const entry = (slug) => ({ _id: slug, name: slug, type: "move", system: { slug } });

function storeWith(...slugs) {
	const store = new FakeWorldItemStore();
	for (const slug of slugs) store.add(entry(slug));
	return store;
}

const catalogOf = (...slugs) => new ItemSlugCatalog([storeWith(...slugs)]);

describe("ItemSlugCatalog", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("merges the taken slugs of every store it reads", async () => {
		const catalog = new ItemSlugCatalog([storeWith("clash", "defy"), storeWith("defy", "parley")]);

		expect([...(await catalog.takenSlugs())].sort()).toEqual(["clash", "defy", "parley"]);
	});

	it("ignores entries carrying no slug", async () => {
		const store = new FakeWorldItemStore().add({ _id: "x", name: "X", type: "move", system: {} });

		expect(await new ItemSlugCatalog([store]).takenSlugs()).toEqual(new Set());
	});

	it("hands back a free slug untouched", async () => {
		expect(await catalogOf("clash").uniqueSlug("parley")).toBe("parley");
	});

	it("numbers the first copy of a taken slug", async () => {
		expect(await catalogOf("clash").uniqueSlug("clash")).toBe("clash-2");
	});

	it("skips past copy numbers already taken", async () => {
		expect(await catalogOf("clash", "clash-2", "clash-3").uniqueSlug("clash")).toBe("clash-4");
	});

	it("counts on from the source's own copy number rather than nesting suffixes", async () => {
		expect(await catalogOf("clash", "clash-2").uniqueSlug("clash-2")).toBe("clash-3");
	});

	it("keeps a slug that is only digits after the dash when nothing collides", async () => {
		expect(await catalogOf("clash").uniqueSlug("hack-2")).toBe("hack-2");
	});

	describe("forType", () => {
		it("reads the type's compendium and the world alike", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.movesPack().withItem(entry("clash")))
				.withWorldItem({ ...entry("parley"), toObject() { return entry("parley"); } })
				.build();

			const catalog = ItemSlugCatalog.forType("move");

			expect([...(await catalog.takenSlugs())].sort()).toEqual(["clash", "parley"]);
			expect(await catalog.uniqueSlug("clash")).toBe("clash-2");
		});

		it("is world-only for a type that ships no compendium", async () => {
			const legacy = { _id: "n", name: "N", type: "npc", system: { slug: "crew" } };
			new FakeGameBuilder().withWorldItem({ ...legacy, toObject() { return legacy; } }).build();

			expect(await ItemSlugCatalog.forType("npc").takenSlugs()).toEqual(new Set(["crew"]));
		});
	});
});
