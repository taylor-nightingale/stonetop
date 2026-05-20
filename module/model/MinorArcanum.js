import { ResourceDef } from "./Resource.js";

export class MinorArcanumItem {
	constructor(data) {
		this.name            = data.name;
		this.weight          = data.weight          ?? null;
		this.note            = data.note            ?? null;
		this.inventoryColumn = data.inventoryColumn ?? null;
		this.resource        = data.resource ? new ResourceDef(data.resource) : null;
	}
}

export class MinorArcanumMove {
	constructor(data) {
		this.name        = data.name;
		this.rollType    = data.rollType    ?? null;
		this.description = data.description;
	}
}

export class MinorArcanumFront {
	constructor(data) {
		this.title       = data.title;
		this.item        = data.item ? new MinorArcanumItem(data.item) : null;
		this.description = data.description;
		this.unlock      = data.unlock;
	}
}

export class MinorArcanumBack {
	constructor(data) {
		this.title       = data.title;
		this.item        = data.item ? new MinorArcanumItem(data.item) : null;
		this.description = data.description;
		this.resource    = data.resource ? new ResourceDef(data.resource) : null;
		this.move        = data.move ? new MinorArcanumMove(data.move) : null;
		this.options     = data.options ?? [];
	}
}

export class MinorArcanum {
	constructor(data) {
		this.slug  = data.slug;
		this.front = new MinorArcanumFront(data.front);
		this.back  = new MinorArcanumBack(data.back);
	}
}
