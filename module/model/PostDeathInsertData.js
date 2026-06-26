import {ITEM_FLAG_SCOPE} from "../actors/character/StonetopFlags.js";

export class PostDeathInsertData {
	constructor(doc) {
		const flags      = doc.flags?.[ITEM_FLAG_SCOPE] ?? {};
		this.slug        = doc.system?.slug ?? "";
		this.name        = doc.name         ?? "";
		this.img         = doc.img          ?? null;
		this.description = doc.system?.description ?? null;
		this.instincts   = flags.instincts  ?? [];
		this.lore        = flags.lore       ?? [];
	}
}
