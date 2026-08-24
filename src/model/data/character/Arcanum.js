import { Resource } from "../Resource.js";
import { Tags } from "../Tags.js";

export class ArcanumItem {
	constructor(data) {
		this.name            = data.name;
		this.weight          = data.weight          ?? null;
		this.tags            = Tags.gear(data.tagList);
		this.note            = data.note            ?? null;
		this.inventoryColumn = data.inventoryColumn ?? null;
		this.twoCol          = data.twoCol          ?? false;
		this.resource        = data.resource ? new Resource(data.resource) : null;
	}
}

// Legacy single-group data (or a bare `unlock` group) is wrapped so old saves render before migration.
function toChoiceGroups(choices) {
	return Array.isArray(choices) ? choices : (choices ? [choices] : []);
}

// The card as it reads before its mysteries are unlocked. A front has NO name of its own — the arcanum's
// document name is its heading. It carries header chrome (a ◇ outfit item, or disguise tags when there is
// no item, plus an optional resource track) above a body that is entirely `choices` — an ordered array of
// choice groups (a text-only entry stands in for the old `description`; □ tracks, follower/move grants,
// and section headers all live there too).
export class ArcanumFront {
	// `front` is a nullable ObjectField, so an unauthored side arrives as null rather than undefined.
	constructor(data) {
		const d = data ?? {};
		this.item     = d.item ? new ArcanumItem(d.item) : null;
		this.tags     = Tags.gear(d.tagList); // disguise tags for a front with no ◇ outfit item
		this.resource = d.resource ? new Resource(d.resource) : null;
		this.choices  = toChoiceGroups(d.choices);
	}
}

// The unlocked mystery. Same chrome and body as the front, plus its OWN `title` — the mystery's name
// ("Mysteries of the Azure Hand", "Thunderbolt Bow"), deliberately distinct from the arcanum's name.
// `itemSameAsFront` is a back-only authoring flag: pass the front's raw item data and the back resolves
// it, so a built back only ever carries an `item`.
export class ArcanumBack {
	constructor(data, frontItemData = null) {
		const d = data ?? {};
		const itemData = d.itemSameAsFront ? frontItemData : d.item;
		this.title    = d.title ?? null;
		this.item     = itemData ? new ArcanumItem(itemData) : null;
		this.tags     = Tags.gear(d.tagList);
		this.resource = d.resource ? new Resource(d.resource) : null;
		this.choices  = toChoiceGroups(d.choices);
	}
}

export class Arcanum {
	constructor(data) {
		this.slug  = data.slug;
		this.major = data.major ?? false;
		this.name  = data.name  ?? null;
		this.img   = (data.img && !data.img.startsWith('icons/')) ? data.img : null;
		this.front = new ArcanumFront(data.front);
		this.back  = new ArcanumBack(data.back, data.front?.item ?? null);
	}
}
