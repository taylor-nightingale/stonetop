import {
	LoadOptionSnapshot,
	LoadSnapshotBuilder,
	OutfitItemSnapshotBuilder,
	OutfitSection,
	OutfitSnapshotBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import {EmbeddedOutfitItemBuilder} from "../../model/data/character/EmbeddedOutfitItem.js";
import {OutfitItemBuilder} from "../../model/data/character/OutfitItem.js";
import { ResourceController } from "./ResourceController.js";

export class CharacterInventory {
	constructor(actor, inventoryRepo, outfitItems, resourceController) {
		this._actor = actor;
		this._repo = inventoryRepo;
		this._outfitItems = outfitItems;
		this._resourceController = resourceController;
	}

	get checked()     { return this._actor.system?.inventory?.checked     ?? {}; }
	get loadLevel()   { return this._actor.system?.inventory?.loadLevel   ?? null; }
	get regularPool() { return this._actor.system?.inventory?.regularPool ?? 0; }
	get smallPool()   { return this._actor.system?.inventory?.smallPool   ?? 0; }
	get otherItems()  { return this._actor.system?.inventory?.otherItems  ?? ""; }

	async setItemChecked(slug, isChecked) {
		await this._actor.update({ "system.inventory.checked": { ...this.checked, [slug]: isChecked } });
	}

	async setResource(slug, count) {
		await this._resourceController.set("inventory", slug, count);
	}

	async setLoadLevel(level) {
		await this._actor.update({ "system.inventory.loadLevel": level });
	}

	async setRegularPool(count) {
		await this._actor.update({ "system.inventory.regularPool": count });
	}

	async setSmallPool(count) {
		await this._actor.update({ "system.inventory.smallPool": count });
	}

	async setOtherItems(value) {
		await this._actor.update({ "system.inventory.otherItems": value });
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

		const mapItem = (outfitItem) => {
			return new OutfitItemSnapshotBuilder()
				.withSlug(outfitItem.slug)
				.withName(outfitItem.name)
				.withTags(outfitItem.tags)
				.withNote(outfitItem.note)
				.withWeight(outfitItem.weight)
				.withChecked(checked[outfitItem.slug] ?? false)
				.withResource(this._resourceController.buildSnapshot("inventory", outfitItem.resource, outfitItem.slug))
				.withIsCustom(outfitItem.ownedId != null)
				.withOwnedId(outfitItem.ownedId ?? null)
				.withTwoCol(outfitItem.twoCol)
				.build();
		};

		const embeddedItems = this._outfitItems.getAll().map(i => {
			const sys    = i.system ?? {};
			const source = sys.source ?? null;
			return new OutfitItemBuilder()
				.withSlug(sys.slug ?? i._id)
				.withName(i.name)
				.withWeight(sys.weight ?? 1)
				.withTags(sys.tags ?? "")
				.withNote(sys.note ?? null)
				.withInventoryColumn(sys.inventoryColumn ?? "regular")
				.withResource(sys.resource ?? null)
				.withTwoCol(sys.twoCol ?? false)
				.withOwnedId(source == null ? i._id : null)
				.build();
		});

		const repoItems = await this._repo.getAll();

		return new OutfitSnapshotBuilder()
			.withLoad(this.buildLoadSnapshot(this.loadLevel))
			.withRegularSections(_buildSections(repoItems, embeddedItems, "regular", mapItem))
			.withRegularPool(ResourceController.build({ max: 9, title: null, labels: [] }, this.regularPool))
			.withSmallSections(_buildSections(repoItems, embeddedItems, "small", mapItem))
			.withSmallPool(ResourceController.build({ max: 9, title: null, labels: [] }, this.smallPool))
			.withOtherItems(this.otherItems)
			.build();
	}

	buildLoadSnapshot(loadLevel) {
		return new LoadSnapshotBuilder()
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
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _loc(key) {
	return typeof game !== "undefined" ? game.i18n.localize(key) : key;
}

function _buildSections(repoItems, embeddedItems, column, mapItem) {
	const colRepo     = repoItems.filter(i => i.inventoryColumn === column);
	const colEmbedded = embeddedItems.filter(i => i.inventoryColumn === column);

	// Group repo items by folder-derived group, preserving encounter order
	const groupMap = new Map();
	for (const item of colRepo) {
		const g = item.group;
		if (!groupMap.has(g)) groupMap.set(g, []);
		groupMap.get(g).push(mapItem(item));
	}

	const sections = [...groupMap.entries()].map(([name, items]) => new OutfitSection(name, items));

	// Embedded items (arcana, possessions, custom) always trail as their own section
	if (colEmbedded.length > 0) {
		sections.push(new OutfitSection(null, colEmbedded.map(mapItem)));
	}

	return sections;
}
