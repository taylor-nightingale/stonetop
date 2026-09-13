import { afterEach, describe, it, expect, vi } from "vitest";
import { createStonetopItemClass } from "../../src/item/StonetopItem.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { FakePackBuilder } from "../fakes/foundry/FakePackBuilder.js";

// The slice of Item that _preCreate touches: the source data it was built from, the context that says
// where it is being created (parent actor / compendium), and updateSource to amend it before it saves.
class FakeBaseItem {
	constructor({ type = "move", slug = null, parent = null, pack = null } = {}) {
		this.type   = type;
		this.system = { slug };
		this.parent = parent;
		this.pack   = pack;
	}

	async _preCreate() {}

	updateSource(changes) {
		for (const [path, value] of Object.entries(changes)) {
			expect(path).toBe("system.slug");
			this.system.slug = value;
		}
	}
}

const StonetopItem = createStonetopItemClass(FakeBaseItem);

const packMove = (slug) => ({ _id: slug, name: slug, type: "move", system: { slug } });

function worldWith(...slugs) {
	const game = new FakeGameBuilder().withPack(FakePackBuilder.movesPack().withItem(packMove("clash")));
	for (const slug of slugs) {
		const item = packMove(slug);
		game.withWorldItem({ ...item, toObject() { return item; } });
	}
	game.build();
}

// Drop the item into the world the way Foundry does: build it, then let _preCreate amend the source.
async function create(options) {
	const item = new StonetopItem(options);
	await item._preCreate({}, {}, null);
	return item;
}

describe("StonetopItem slugs on create", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("re-slugs a world copy of a compendium item", async () => {
		worldWith();

		expect((await create({ slug: "clash" })).system.slug).toBe("clash-2");
	});

	it("counts past world copies already made", async () => {
		worldWith("clash-2");

		expect((await create({ slug: "clash" })).system.slug).toBe("clash-3");
	});

	it("leaves a slug nothing else claims alone", async () => {
		worldWith();

		expect((await create({ slug: "parley" })).system.slug).toBe("parley");
	});

	it("leaves an item embedded on an actor alone — grants match an owned item by slug", async () => {
		worldWith();

		expect((await create({ slug: "clash", parent: { name: "Ana" } })).system.slug).toBe("clash");
	});

	it("leaves an item created inside a compendium alone", async () => {
		worldWith();

		expect((await create({ slug: "clash", pack: "world.homebrew" })).system.slug).toBe("clash");
	});

	it("stamps nothing on an item that carries no slug", async () => {
		worldWith();

		expect((await create({ slug: null })).system.slug).toBeNull();
	});

	it("honours a base class that vetoes the creation", async () => {
		worldWith();
		class VetoingItem extends FakeBaseItem { async _preCreate() { return false; } }
		const item = new (createStonetopItemClass(VetoingItem))({ slug: "clash" });

		expect(await item._preCreate({}, {}, null)).toBe(false);
		expect(item.system.slug).toBe("clash");
	});
});
