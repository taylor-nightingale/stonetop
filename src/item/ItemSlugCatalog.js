import { FoundryPackStore } from "../actors/character/repositories/FoundryPackStore.js";
import { WorldItemStore } from "../actors/character/repositories/WorldItemStore.js";
import { PACK_BY_TYPE } from "./packsByType.js";

const COPY_SUFFIX = /-\d+$/;

// Which slugs of one item type are already spoken for, and what a new item of that type may be
// called. Reads through the same stores the repositories do, so a slug is "taken" here exactly when
// a lookup elsewhere would find it.
export class ItemSlugCatalog {
	constructor(stores) {
		this._stores = stores;
	}

	static forType(type) {
		const packName = PACK_BY_TYPE[type];
		const stores   = packName ? [new FoundryPackStore(packName, ["system.slug"])] : [];
		return new ItemSlugCatalog([...stores, new WorldItemStore(type)]);
	}

	async takenSlugs() {
		const entries = await Promise.all(this._stores.map(store => store.getAll()));
		return new Set(entries.flat().map(e => e.system?.slug).filter(Boolean));
	}

	// `desired` if it is free, else the first free `<base>-<n>`, where base drops a trailing copy
	// number so a copy of "shield-2" is "shield-3" rather than "shield-2-2".
	async uniqueSlug(desired) {
		const taken = await this.takenSlugs();
		if (!taken.has(desired)) return desired;
		const base = desired.replace(COPY_SUFFIX, "") || desired;
		for (let n = 2; ; n++) {
			const candidate = `${base}-${n}`;
			if (!taken.has(candidate)) return candidate;
		}
	}
}
