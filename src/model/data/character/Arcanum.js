import { Resource } from "../Resource.js";

export class ArcanumItem {
	constructor(data) {
		this.name            = data.name;
		this.weight          = data.weight          ?? null;
		this.tags            = data.tags            ?? null;
		this.note            = data.note            ?? null;
		this.inventoryColumn = data.inventoryColumn ?? null;
		this.twoCol          = data.twoCol          ?? false;
		this.resource        = data.resource ? new Resource(data.resource) : null;
	}
}

export class ArcanumFront {
	constructor(data) {
		this.title       = data.title;
		this.item        = data.item ? new ArcanumItem(data.item) : null;
		this.tags        = data.tags ?? null; // disguise tags for a front with no ◇ outfit item
		this.description = data.description;
		this.unlock      = data.unlock ?? null;
	}
}

export class ArcanumBack {
	constructor(data) {
		this.title        = data.title        ?? null;
		// `choices` is an ordered array of choice groups (spells / moves / followers / consequences). A
		// move is a choice entry that grants the move inline; a consequence is just another group. Legacy
		// single-group data is wrapped so old saves still render before migration.
		this.choices      = Array.isArray(data.choices) ? data.choices : (data.choices ? [data.choices] : []);
		this.item         = data.item ? new ArcanumItem(data.item) : null;
		this.description  = data.description  ?? null;
		this.resource     = data.resource ? new Resource(data.resource) : null;
		this.options      = data.options      ?? [];
		this.unlockAt     = data.unlockAt     ?? null;
	}
}

export class Arcanum {
	constructor(data) {
		this.slug  = data.slug;
		this.major = data.major ?? false;
		this.name  = data.name  ?? null;
		this.img   = (data.img && !data.img.startsWith('icons/')) ? data.img : null;
		this.front = new ArcanumFront(data.front);
		const back = data.back ?? {};
		this.back  = new ArcanumBack(
			back.itemSameAsFront ? { ...back, item: data.front?.item ?? null } : back,
		);
	}
}
