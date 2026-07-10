// One coinage denomination for a steading — a named currency (silver, gold) with its purse/handful/coin
// counts. An entity like `Person`: immutable `with…` updates and static factories, so no field-string
// mutation leaks to callers. `label` is the capitalized display name; `title` stays the canonical key.
export class Currency {
	constructor(title, purses = 0, handfuls = 0, coins = 0) {
		this.title    = title;
		this.purses   = purses;
		this.handfuls = handfuls;
		this.coins    = coins;
	}

	get label() {
		return this.title ? this.title[0].toUpperCase() + this.title.slice(1) : "";
	}

	withPurses(purses)     { return Currency.fromRaw({ ...this, purses }); }
	withHandfuls(handfuls) { return Currency.fromRaw({ ...this, handfuls }); }
	withCoins(coins)       { return Currency.fromRaw({ ...this, coins }); }

	static of(title) {
		return new Currency(title);
	}

	static fromRaw(raw) {
		return new Currency(raw.title ?? "", raw.purses ?? 0, raw.handfuls ?? 0, raw.coins ?? 0);
	}

	toJSON() {
		return { title: this.title, purses: this.purses, handfuls: this.handfuls, coins: this.coins };
	}
}
