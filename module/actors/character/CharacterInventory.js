import {
	OutfitItemSnapshotBuilder,
	InventorySegmentSnapshot,
	InventorySnapshot,
	LoadOptionSnapshot,
	LoadSnapshotBuilder,
	OutfitSnapshotBuilder,
	ResourceBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { OutfitItemBuilder } from "../../model/data/character/OutfitItem.js";

export class CharacterInventory {
	constructor(flags, inventoryRepo, possessions, actor, playbook) {
		this._flags          = flags;
		this._repo           = inventoryRepo;
		this._possessions    = possessions;
		this._actor          = actor;
		this._playbook       = playbook;
		this._itemsBySource  = new Map();
	}

	setVitals(vitals)     { this._vitals = vitals; }
	setArcanaItems(items) { this._itemsBySource.set("arcana", items); }

	get _additionalItems() { return [...this._itemsBySource.values()].flat(); }

	get checked()      { return this._flags.getFlag("checked") ?? {}; }
	get resources()    { return this._flags.getFlag("resources") ?? {}; }
	get loadLevel()    { return this._flags.getFlag("loadLevel") ?? null; }
	get regularPool()  { return this._flags.getFlag("regularPool") ?? 0; }
	get smallPool()    { return this._flags.getFlag("smallPool") ?? 0; }

	async setItemChecked(slug, isChecked) {
		await this._flags.setFlag("checked", { ...this.checked, [slug]: isChecked });
	}

	async setResource(slug, count) {
		await this._flags.setFlag("resources", { ...this.resources, [slug]: count });
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
		await this._actor.createEmbeddedDocuments("Item", [{
			name,
			type: "equipment",
			system: { equipmentType: "inventory-custom", inventoryColumn: "regular", weight: Math.max(1, weight) },
		}]);
	}

	async addCustomSmallItem(name) {
		await this._actor.createEmbeddedDocuments("Item", [{
			name,
			type: "equipment",
			system: { equipmentType: "inventory-custom", inventoryColumn: "small" },
		}]);
	}

	async removeCustomItem(itemId) {
		await this._actor.deleteEmbeddedDocuments("Item", [itemId]);
	}

	calculateArmor(allItems) {
		const equipped  = allItems.filter(item => this.checked[item.slug] && item.armor);
		const bases     = equipped.filter(i => i.armor.base     != null).map(i => i.armor.base);
		const modifiers = equipped.filter(i => i.armor.modifier != null).map(i => i.armor.modifier);
		const base = bases.length > 0 ? Math.max(...bases) : 0;
		return base + modifiers.reduce((s, m) => s + m, 0);
	}

	async getArmor() {
		const allItems = await this._repo.getAll();
		return this.calculateArmor(allItems);
	}

	async buildSnapshot() {
		const customItems = [...(this._actor.items ?? [])]
			.filter(i => i.type === "equipment" && i.system?.equipmentType === "inventory-custom")
			.map(i => new OutfitItemBuilder()
				.withSlug(i._id)
				.withName(i.name)
				.withWeight(i.system.weight ?? 1)
				.withNote(null)
				.withInventoryColumn(i.system.inventoryColumn)
				.withResource(null)
				.withTwoCol(false)
				.withBreakBefore(false)
				.withOwnedId(i._id)
				.build());
		this._itemsBySource.set("custom", customItems);
		const playbookData    = await this._playbook.getData();
		const actorLevel      = this._vitals?.level ?? 1;
		const checked         = this.checked;
		const resources       = this.resources;
		const rPool           = this.regularPool;
		const sPool           = this.smallPool;
		const loadLevel       = this.loadLevel;
		const allItems        = await this._repo.getAll();
		const additionalItems = this._additionalItems;

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

		const allSmall   = allItems.filter(i => i.inventoryColumn === "small");
		const addlSmall  = additionalItems.filter(i => i.inventoryColumn === "small");
		const flatRegular = [
			...allItems.filter(i => i.inventoryColumn === "regular").map(mapItem),
			...additionalItems.filter(i => i.inventoryColumn === "regular").map(mapItem),
		];

		const possessions = this._possessions.buildSnapshot(
			playbookData?.specialPossessions ?? null, actorLevel
		);

		const load = new LoadSnapshotBuilder()
			.withInstruction(_loc("stonetop.inventory.outfit.heading"))
			.withSelected(loadLevel ?? null)
			.withLoadLevelLight(loadLevel === "light")
			.withLoadLevelNormal(loadLevel === "normal")
			.withLoadLevelHeavy(loadLevel === "heavy")
			.withOptions([
				new LoadOptionSnapshot("light",  "Light",  _loc("stonetop.inventory.outfit.light")),
				new LoadOptionSnapshot("normal", "Normal", _loc("stonetop.inventory.outfit.normal")),
				new LoadOptionSnapshot("heavy",  "Heavy",  _loc("stonetop.inventory.outfit.heavy")),
			])
			.build();

		const outfit = new OutfitSnapshotBuilder()
			.withLoad(load)
			.withRegularItems(flatRegular)
			.withRegularSegments(_segmentByTwoCol(flatRegular))
			.withRegularPool(new ResourceBuilder().withCurrent(rPool).withMax(9).withTitle(null).withLabels([]).build())
			.withSmallItems([
				...allSmall.filter(i => !i.smallGrid).map(mapItem),
				...addlSmall.filter(i => !i.smallGrid).map(mapItem),
			])
			.withSmallGridItems([
				...allSmall.filter(i => i.smallGrid).map(mapItem),
				...addlSmall.filter(i => i.smallGrid).map(mapItem),
			])
			.withSmallPool(new ResourceBuilder().withCurrent(sPool).withMax(9).withTitle(null).withLabels([]).build())
			.build();

		return new InventorySnapshot(outfit, possessions);
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
