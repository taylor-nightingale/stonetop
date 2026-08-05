/** One checked item's contribution to Armor. */
export class ArmorContribution {
	constructor(name, amount, isBase) {
		this.name   = name;
		this.amount = amount;
		this.isBase = isBase;
	}
}

/** What the checked gear says Armor should be, and which items say it. */
export class ArmorBreakdown {
	// Base armor doesn't stack — only the highest-rated worn armor counts — while every modifier
	// (shields, trinkets) adds on top. Callers pass only the items the character has checked.
	static fromItems(items) {
		const armored = items.filter(item => item.armor);
		const bases   = armored.filter(item => item.armor.base != null);
		const best    = bases.reduce((highest, item) =>
			highest == null || item.armor.base > highest.armor.base ? item : highest, null);

		const contributions = best ? [new ArmorContribution(best.name, best.armor.base, true)] : [];
		for (const item of armored.filter(item => item.armor.modifier != null))
			contributions.push(new ArmorContribution(item.name, item.armor.modifier, false));

		return new ArmorBreakdown(contributions);
	}

	static empty() {
		return new ArmorBreakdown([]);
	}

	constructor(contributions) {
		this.contributions = contributions;
		this.value         = contributions.reduce((total, c) => total + c.amount, 0);
	}

	get isEmpty() {
		return this.contributions.length === 0;
	}
}
