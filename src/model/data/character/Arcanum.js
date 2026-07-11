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

// Mystery moves are major-arcana-only.

export class ArcanumMysteryMove {
	constructor(data) {
		this.id           = data.id;
		this.name         = data.name;
		this.subtitle     = data.subtitle     ?? null;
		this.tracker      = data.tracker      ?? null;
		this.text         = data.text;
		this.followerSlug = data.followerSlug ?? null;
	}
}

export class ArcanumBack {
	constructor(data) {
		this.title        = data.title        ?? null;
		this.choices      = data.choices      ?? null;
		this.item         = data.item ? new ArcanumItem(data.item) : null;
		this.description  = data.description  ?? null;
		this.resource     = data.resource ? new Resource(data.resource) : null;
		this.options      = data.options      ?? [];
		// Major arcana reference their mystery moves by slug (back.moveSlugs) — resolved to real `move`
		// items on the character. `moves` is the legacy inline shape, still used by minor arcana and
		// custom-authored arcana (and as a render fallback when moveSlugs is empty).
		this.moveSlugs    = data.moveSlugs    ?? [];
		this.moves        = (data.moves ?? []).map(m => new ArcanumMysteryMove(m));
		this.consequences = data.consequences ?? null;
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
