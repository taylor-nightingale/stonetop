import {Resource} from "./Resource.js";
import {toSlug} from "../../utils/slug.js";

export class Move {
	constructor(data) {
		this.id          = data._id;
		this.name        = data.name;
		// Prefer the stored, stable slug (survives renames); fall back to the name-derived one for
		// moves authored before slugs were stamped (packs + worlds get backfilled by migration).
		this.slug        = data.system?.slug || toSlug(data.name);
		this.playbook    = data.system?.playbook        ?? null;
		this.rollStat    = data.system?.rollStat        ?? null;
		this.description = data.system?.description     ?? null;
		this.isStarting  = data.system?.isStartingMove  ?? false;
		this.requirement = data.system?.requirement     ?? null;
		this.repeatMax   = data.system?.repeatMax       ?? null;
		this.resource    = data.system?.resource    ? new Resource(data.system.resource) : null;
		this.choices     = data.system?.choices     ?? null;
		this.moveResults = data.system?.moveResults ?? null;
	}

	get requires() { return this.requirement?.moves?.[0] ?? null; }
	get minLevel()  { return this.requirement?.level      ?? null; }
}
