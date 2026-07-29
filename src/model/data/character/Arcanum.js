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

// One side of an arcanum card. Front and back share this shape: header chrome (title, item, tags,
// resource) + a body that is entirely `choices` — an ordered array of choice groups (a text-only entry
// stands in for the old `description`; □ tracks, follower/move grants, and section headers all live here).
// The resolved side just carries `item`; whether the back's item came from the front (`itemSameAsFront`)
// is a back-only authoring flag on the raw data, resolved by the Arcanum constructor below — it never
// needs to live on the side.
export class ArcanumSide {
	constructor(data = {}) {
		this.title    = data.title ?? null;
		this.item     = data.item ? new ArcanumItem(data.item) : null;
		this.tags     = data.tags ?? null; // disguise tags for a front with no ◇ outfit item
		this.resource = data.resource ? new Resource(data.resource) : null;
		// Legacy single-group data (or a bare `unlock` group) is wrapped so old saves render before migration.
		this.choices  = Array.isArray(data.choices) ? data.choices : (data.choices ? [data.choices] : []);
	}
}

export class Arcanum {
	constructor(data) {
		this.slug  = data.slug;
		this.major = data.major ?? false;
		this.name  = data.name  ?? null;
		this.img   = (data.img && !data.img.startsWith('icons/')) ? data.img : null;
		this.front = new ArcanumSide(data.front);
		const back = data.back ?? {};
		// The back's `itemSameAsFront` flag (raw data) copies the front item onto the back.
		this.back  = new ArcanumSide(
			back.itemSameAsFront ? { ...back, item: data.front?.item ?? null } : back,
		);
	}
}
