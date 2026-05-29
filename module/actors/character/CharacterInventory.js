import {
	InventorySnapshot,
	LoadOptionSnapshot,
	LoadSnapshotBuilder,
	OutfitItemSnapshotBuilder,
	OutfitSection,
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
				.build();
		};

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
				.withOwnedId(source == null ? i._id : null)
				.build();
		});

		const repoItems = await this._repo.getAll();

		const outfit = new OutfitSnapshotBuilder()
			.withLoad(this.buildLoadSnapshot(this.loadLevel))
			.withRegularSections(_buildSections(repoItems, embeddedItems, "regular", mapItem))
			.withRegularPool(new ResourceBuilder().withCurrent(this.regularPool).withMax(9).withTitle(null).withLabels([]).build())
			.withSmallSections(_buildSections(repoItems, embeddedItems, "small", mapItem))
			.withSmallPool(new ResourceBuilder().withCurrent(this.smallPool).withMax(9).withTitle(null).withLabels([]).build())
			.build();

		return new InventorySnapshot(outfit, await this._possessions.buildSnapshot(level ?? 1));
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
