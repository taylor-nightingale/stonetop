import { FakeWorldItemStore } from "./FakeWorldItemStore.js";
import { InventoryPage, InventoryColumn, PageSection } from "../../src/model/data/character/InventoryPage.js";

export class FakeInventoryRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(items) {
		this._items = items ?? [];
	}

	addWorld(item) { this._worldStore.add(item); return this; }

	async getAll() {
		const world = await this._worldStore.getAll();
		return [...this._items, ...world];
	}

	/** A page listing exactly what this fixture holds — see pageOf. */
	get page() {
		return pageOf(this._items);
	}

	async bySlug() {
		return new Map((await this.getAll()).map(item => [item.slug, item]));
	}
}

/**
 * A page listing exactly the gear a fixture holds, each column one section, in the order given.
 *
 * The real page is Book I p. 142 and names its rows by slug, so a fixture full of "test-item" would
 * render nothing against it. This is the fixture's own page — which is also the honest test of the
 * split: the page decides what is drawn and in what order, and here the fixture decides the page.
 */
export function pageOf(items, { note = null } = {}) {
	const column = (key) => {
		const slugs = items.filter(i => (i.inventoryColumn ?? "regular") === key).map(i => i.slug);
		return new InventoryColumn(key, slugs.length ? [new PageSection(slugs, { note })] : []);
	};
	return new InventoryPage([column("regular"), column("small")]);
}
