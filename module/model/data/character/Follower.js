export class Follower {
	constructor(data) {
		this.slug    = data.slug;
		this.name    = data.name;
		this.note    = data.note    ?? null;
		this.hp      = data.hp      ?? { max: 0 };
		this.armor   = data.armor   ?? 0;
		this.damage  = data.damage  ?? null;
		this.loyalty = data.loyalty ?? { max: 0 };
		this.choices = data.choices ?? null;
	}
}
