import {
	InventorySegmentSnapshot,
	InventorySnapshot,
	LoadOptionSnapshot,
	LoadSnapshotBuilder,
	OutfitItemSnapshotBuilder,
	OutfitSnapshotBuilder,
	ResourceBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import {EmbeddedOutfitItemBuilder} from "../../model/data/character/EmbeddedOutfitItem.js";
import {OutfitItemBuilder} from "../../model/data/character/OutfitItem.js";

export class CharacterInventory {
constructor(flags, inventoryRepo, possessions, outfitItems) {
		this._flags = flags;
		this._repo = inventoryRepo;
		this._possessions = possessions;
		this._outfitItems = outfitItems;
	}

	get checked()     { return this._flags.getFlag("checked") ?? {}; }
	get resources()   { return this._flags.getFlag("resources") ?? {}; }
	get loadLevel()   { return this._flags.getFlag("loadLevel") ?? null; }
	get regularPool() { return this._flags.getFlag("regularPool") ?? 0; }
	get smallPool()   { return this._flags.getFlag("smallPool") ?? 0; }

	async setItemChecked(slug, isChecked) {
		await this._flags.setFlag("checked", {...this.checked, [slug]: isChecked});
	}

	async setResource(slug, count) {
		await this._flags.setFlag("resources", {...this.resources, [slug]: count});
	}

	async setLoadLevel(level) {
		await this._flags.setFlag("loadLevel", level);
	}

	async setRegularPool(count) {
		await this._flags.setFlag("regularPool", count);
	}

	async setSmallPool(count) {
		await this._flags.setFlag("smallPool", count);
	}

	async addCustomItem(name, weight) {
		await this._outfitItems.create([new EmbeddedOutfitItemBuilder()
			.withName(name)
			.withWeight(Math.max(1, weight))
			.withInventoryColumn("regular")
			.build()]);
	}

	async addCustomSmallItem(name) {
		await this._outfitItems.create([new EmbeddedOutfitItemBuilder()
			.withName(name)
			.withInventoryColumn("small")
			.build()]);
	}

	async removeCustomItem(itemId) {
		await this._outfitItems.deleteById(itemId);
	}

	calculateArmor(allItems) {
		const equipped = allItems.filter(item => this.checked[item.slug] && item.armor);
		const bases = equipped.filter(i => i.armor.base != null).map(i => i.armor.base);
		const modifiers = equipped.filter(i => i.armor.modifier != null).map(i => i.armor.modifier);
		const base = bases.length > 0 ? Math.max(...bases) : 0;
		return base + modifiers.reduce((s, m) => s + m, 0);
	}

	async getArmor() {
		const allItems = await this._repo.getAll();
		return this.calculateArmor(allItems);
	}

	async buildSnapshot(level) {
		const checked = this.checked;
		const resources = this.resources;

		const mapItem = (outfitItem) => {
			const res = outfitItem.resource;
			return new OutfitItemSnapshotBuilder()
				.withSlug(outfitItem.slug)
				.withName(outfitItem.name)
				.withNote(outfitItem.note)
				.withWeight(outfitItem.weight)
				.withChecked(checked[outfitItem.slug] ?? false)
				.withResource(res ? new ResourceBuilder()
					.withCurrent(resources[outfitItem.slug] ?? 0)
					.withMax(res.max)
					.withTitle(res.title ?? null)
					.withLabels(res.labels ?? [])
					.build() : null)
				.withIsCustom(outfitItem.ownedId != null)
				.withOwnedId(outfitItem.ownedId ?? null)
				.withTwoCol(outfitItem.twoCol)
				.withBreakBefore(outfitItem.breakBefore)
				.build();
		};

		// Embedded items: arcana, possessions, and user-created custom items
		const embeddedItems = this._outfitItems.getAll().map(i => {
			const st = i.flags?.stonetop ?? {};
			const source = st.source ?? null;
			return new OutfitItemBuilder()
				.withSlug(st.slug ?? i._id)
				.withName(i.name)
				.withWeight(i.system?.weight ?? st.weight ?? 1)
				.withNote(st.note ?? null)
				.withInventoryColumn(st.inventoryColumn ?? "regular")
				.withResource(st.resource ?? null)
				.withTwoCol(st.twoCol ?? false)
				.withBreakBefore(st.breakBefore ?? false)
				.withOwnedId(source == null ? i._id : null)
				.build();
		});

		const rPool = this.regularPool;
		const sPool = this.smallPool;
		const loadLevel = this.loadLevel;
		const repoItems = await this._repo.getAll();

		const repoRegular     = repoItems.filter(i => i.inventoryColumn === "regular");
		const embeddedRegular = embeddedItems.filter(i => i.inventoryColumn === "regular");

		if (embeddedRegular.length > 0 && repoRegular.length > 0) {
			embeddedRegular[0].breakBefore = true;
		}

		const flatRegular = [...repoRegular, ...embeddedRegular].map(mapItem);

		const repoSmall = repoItems.filter(i => i.inventoryColumn === "small");
		const embeddedSmall = embeddedItems.filter(i => i.inventoryColumn === "small");
		if (embeddedSmall.length > 0 && repoSmall.length > 0) {
			embeddedSmall[0].breakBefore = true;
		}
		const allSmall = [...repoSmall, ...embeddedSmall];

		const outfit = new OutfitSnapshotBuilder()
			.withLoad(this.buildLoadSnapshot(loadLevel))
			.withRegularItems(flatRegular)
			.withRegularSegments(_segmentByTwoCol(flatRegular))
			.withRegularPool(new ResourceBuilder().withCurrent(rPool).withMax(9).withTitle(null).withLabels([]).build())
			.withSmallItems([
				...allSmall.filter(i => !i.twoCol).map(mapItem),
			])
			.withSmallGridItems([
				...allSmall.filter(i => i.twoCol).map(mapItem),
			])
			.withSmallPool(new ResourceBuilder().withCurrent(sPool).withMax(9).withTitle(null).withLabels([]).build())
			.build();

		return new InventorySnapshot(outfit, await this._possessions.buildSnapshot(level ?? 1));
	}

	buildLoadSnapshot(loadLevel) {
		const load = new LoadSnapshotBuilder()
			.withInstruction(_loc("stonetop.inventory.outfit.heading"))
			.withSelected(loadLevel ?? null)
			.withLoadLevelLight(loadLevel === "light")
			.withLoadLevelNormal(loadLevel === "normal")
			.withLoadLevelHeavy(loadLevel === "heavy")
			.withOptions([
				new LoadOptionSnapshot("light", "Light", _loc("stonetop.inventory.outfit.light")),
				new LoadOptionSnapshot("normal", "Normal", _loc("stonetop.inventory.outfit.normal")),
				new LoadOptionSnapshot("heavy", "Heavy", _loc("stonetop.inventory.outfit.heavy")),
			])
			.build();
		return load;
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _loc(key) {
	return typeof game !== "undefined" ? game.i18n.localize(key) : key;
}

function _segmentByTwoCol(items) {
	const segments = [];
	let current = null;
	let currentType = null;
	for (const item of items) {
		const type = item.twoCol ? "grid" : "list";
		if (!current || currentType !== type) {
			current = new InventorySegmentSnapshot(type === "grid", item.breakBefore ?? false, []);
			segments.push(current);
			currentType = type;
		}
		current.items.push(item);
	}
	return segments;
}
