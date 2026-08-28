import {
	LoadOptionSnapshot,
	LoadSnapshotBuilder,
	OutfitSnapshotBuilder,
	ProsperitySnapshot,
	ProsperityRowSnapshot,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import {EmbeddedOutfitItemBuilder} from "../../model/data/character/EmbeddedOutfitItem.js";
import {OutfitItemBuilder} from "../../model/data/character/OutfitItem.js";
import {ArmorBreakdown} from "../../model/data/character/ArmorBreakdown.js";
import { ResourceController } from "./ResourceController.js";
import { GrantStamp } from "../../model/data/ItemGrant.js";
import { OutfitPage, toOutfitItemSnapshot, loadBand, MAX_OUTFIT_MARKS } from "../../model/snapshot/character/outfitSections.js";
import { INVENTORY_INSERT_PAGE } from "../../model/data/character/inventoryInsertPage.js";

// The Prosperity gear table as the inventory insert prints it: fixed rungs, the steading's rating
// only decides which one the character is standing on. A rating past either end marks the nearest
// rung rather than none — a steading can climb past +2.
const _PROSPERITY_ROWS = [
	{ value: -1, noteKey: "stonetop.inventory.prosperityTable.crude" },
	{ value:  0, noteKey: null },
	{ value:  1, noteKey: "stonetop.inventory.prosperityTable.piercing1" },
	{ value:  2, noteKey: "stonetop.inventory.prosperityTable.piercing2" },
];
const _LOAD_LEVELS = ["light", "normal", "heavy"];

const _PROSPERITY_MIN = _PROSPERITY_ROWS[0].value;
const _PROSPERITY_MAX = _PROSPERITY_ROWS.at(-1).value;

export class CharacterInventory {
	// `page` is the printed sheet this inventory reproduces — injected rather than reached for, so a
	// test can render a two-row page and so a second layout would not mean a second CharacterInventory.
	constructor(actor, inventoryRepo, outfitItems, resourceController, steadingRepo = null,
	            page = INVENTORY_INSERT_PAGE) {
		this._actor = actor;
		this._repo = inventoryRepo;
		this._outfitItems = outfitItems;
		this._resourceController = resourceController;
		this._steadingRepo = steadingRepo;
		this._page = page;
	}

	get checked()     { return this._actor.system?.inventory?.checked     ?? {}; }
	get regularPool() { return this._actor.system?.inventory?.regularPool ?? 0; }
	get smallPool()   { return this._actor.system?.inventory?.smallPool   ?? 0; }
	get otherItems()  { return this._actor.system?.inventory?.otherItems  ?? ""; }

	async setItemChecked(slug, isChecked) {
		await this._actor.update({ "system.inventory.checked": { ...this.checked, [slug]: isChecked } });
	}

	async setResource(slug, count) {
		await this._resourceController.set("inventory", slug, count);
	}

	async setRegularPool(count) {
		await this._actor.update({ "system.inventory.regularPool": count });
	}

	async setSmallPool(count) {
		await this._actor.update({ "system.inventory.smallPool": count });
	}

	// Back to an unmarked sheet: every ◇/□ cleared, both undefined pools emptied. Custom items, the
	// "other items" note and item resources are not selections, so they stay.
	//
	// Each checked slug is written as its own deletion key: Foundry MERGES an object update, so
	// storing an empty map would leave every mark exactly where it was.
	async clearSelections() {
		const cleared = Object.fromEntries(Object.keys(this.checked).map(slug => [`-=${slug}`, null]));
		await this._actor.update({
			"system.inventory.checked":     cleared,
			"system.inventory.regularPool": 0,
			"system.inventory.smallPool":   0,
		});
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

	buildArmorBreakdown(allItems) {
		return ArmorBreakdown.fromItems(allItems.filter(item => this.checked[item.slug]));
	}

	calculateArmor(allItems) {
		return this.buildArmorBreakdown(allItems).value;
	}

	async getArmorBreakdown() {
		return this.buildArmorBreakdown((await this._outfitPage()).items);
	}

	/** The printed inventory page, resolved against the gear catalog. The page says what the sheet
	 *  draws and where; the catalog says what each row IS. */
	async _outfitPage() {
		return new OutfitPage(this._page, await this._repo.bySlug(), _loc);
	}

	async getArmor() {
		return (await this.getArmorBreakdown()).value;
	}

	async buildSnapshot(level) {
		const checked = this.checked;
		const resourceFn = oi => this._resourceController.buildSnapshot("inventory", oi.resource, oi.slug);
		const mapItem   = oi => toOutfitItemSnapshot(oi, checked[oi.slug] ?? false, resourceFn(oi));

		const embeddedItems = this._outfitItems.getAll().map(i => {
			const sys = i.system ?? {};
			// Only gear the player added themselves is theirs to delete; a container's grant goes when the
			// container says so, and an unstamped item is exactly the one nobody granted.
			const granted = GrantStamp.of(i) !== null;
			return new OutfitItemBuilder()
				.withSlug(sys.slug ?? i._id)
				.withName(i.name)
				.withWeight(sys.weight ?? 1)
				.withTags(sys.tagList ?? "")
				.withNote(sys.note ?? null)
				.withInventoryColumn(sys.inventoryColumn ?? "regular")
				.withResource(sys.resource ?? null)
				.withOwnedId(granted ? null : i._id)
				.build();
		});

		const page = await this._outfitPage();

		return new OutfitSnapshotBuilder()
			.withLoad(this.buildLoadSnapshot(this.markedWeight(page.itemsIn("regular"), embeddedItems)))
			.withRegularSections(page.forColumn("regular", embeddedItems, mapItem))
			.withRegularPool(ResourceController.build({ max: 9, title: null, labels: [] }, this.regularPool))
			.withSmallSections(page.forColumn("small", embeddedItems, mapItem))
			.withSmallPool(ResourceController.build({ max: 9, title: null, labels: [] }, this.smallPool))
			.withOtherItems(this.otherItems)
			.withProsperity(this.buildProsperitySnapshot())
			.build();
	}

	buildProsperitySnapshot() {
		const steading = this._steadingRepo?.getPrimary() ?? null;
		if (!steading) return null;
		const at = Math.min(_PROSPERITY_MAX, Math.max(_PROSPERITY_MIN, steading.prosperity));
		return new ProsperitySnapshot(
			steading.name,
			steading.prosperity,
			steading.isLacking,
			_PROSPERITY_ROWS.map(row =>
				new ProsperityRowSnapshot(row.value, row.noteKey ? _loc(row.noteKey) : "", row.value === at)),
		);
	}

	// The ◇ a character has marked: every checked regular item's weight, plus the diamonds marked in
	// the "undefined" pool. Small items are □ and carry no load, so the small column is not counted.
	//
	// `regularItems` are the page's own regular rows — the page decides which column a row is in.
	// Gear the page does not list still says so itself, on `inventoryColumn`.
	markedWeight(regularItems, embeddedItems) {
		const checked = this.checked;
		return [...regularItems, ...embeddedItems.filter(i => i.inventoryColumn === "regular")]
			.filter(i => checked[i.slug])
			.reduce((total, i) => total + (i.weight ?? 0), 0) + this.regularPool;
	}

	// Load is read off the sheet, not chosen: the marked ◇ decide the band (same rule the follower
	// inventory uses). Guidance only — nothing here caps what a character may carry.
	buildLoadSnapshot(markedWeight) {
		const band = loadBand(markedWeight);
		return new LoadSnapshotBuilder()
			.withMarkedWeight(markedWeight)
			.withCapacity(MAX_OUTFIT_MARKS)
			.withOverCapacity(markedWeight > MAX_OUTFIT_MARKS)
			.withOptions(_LOAD_LEVELS.map(slug =>
				new LoadOptionSnapshot(slug, _loc(`stonetop.inventory.outfit.${slug}`), slug === band)))
			.build();
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _loc(key) {
	return typeof game !== "undefined" ? game.i18n.localize(key) : key;
}
