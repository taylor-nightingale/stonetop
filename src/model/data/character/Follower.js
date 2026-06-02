export class Follower {
	constructor(data) {
		this.slug             = data.slug;
		this.name             = data.name;
		this.tags             = data.tags             ?? null;
		this.hp               = data.hp               ?? { value: 0, min: 0, max: 0 };
		this.armor            = data.armor            ?? { value: 0, note: "" };
		this.damage           = data.damage           ?? null;
		this.instinct         = data.instinct         ?? "";
		this.loyalty          = data.loyalty          ?? { value: 0, max: 0 };
		this.choices          = data.choices          ?? null;
		this.arcanaSlug       = data.arcanaSlug       ?? null;
		this.specialQualities = data.specialQualities ?? "";
	}
}
