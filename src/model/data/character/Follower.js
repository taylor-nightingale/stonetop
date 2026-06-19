export class Follower {
	constructor(data) {
		this.slug             = data.slug;
		this.name             = data.name;
		this.tags             = data.tagList     ?? data.tags ?? null;
		this.hp               = data.hp               ?? { value: 0, max: 0 };
		this.armor            = data.armor            ?? "";
		this.damage           = data.damage           ?? "";
		this.instinct         = data.instinct         ?? "";
		this.moves            = data.moves            ?? "";
		this.cost             = data.cost             ?? "";
		this.loyalty          = data.loyalty          ?? { value: 0, max: 0 };
		this.choices          = data.choices          ?? null;
		this.arcanaSlug       = data.arcanaSlug       ?? null;
		this.playbookSlug     = data.playbookSlug     ?? null;
		this.specialQuality   = data.specialQuality   ?? "";
		this.description      = data.description       ?? "";
		this.notes            = data.notes            ?? "";
		this.members          = data.members          ?? [];
		this.memberSuggestions = data.memberSuggestions ?? { names: [], tags: [], traits: [] };
		this.membersNote      = data.membersNote      ?? "";
		this.companion        = data.companion        ?? null;
	}
}
