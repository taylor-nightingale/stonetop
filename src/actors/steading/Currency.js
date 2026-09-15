// One coinage denomination for a steading — a named currency (silver, gold) with its purse/handful/coin
// counts. An entity like `Person`: immutable `with…` updates and static factories, so no field-string
// mutation leaks to callers. `title` is the canonical key and `labelKey` the string to display it
// by — the name a player reads is authored copy, so it is localized rather than capitalized out of
// the stored slug in JavaScript.
export class Currency {
	constructor(title, purses = 0, handfuls = 0, coins = 0) {
		this.title    = title;
		this.purses   = purses;
		this.handfuls = handfuls;
		this.coins    = coins;
	}

	/** The i18n key naming this currency, or "" for a currency with no title to name. */
	get labelKey() {
		return this.title ? `stonetop.steading.coinage.${this.title}` : "";
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
