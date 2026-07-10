import { Currency } from "./Currency.js";

// The steading's coinage: a FIXED set of standard currencies (Silver, Gold) that always display. A
// steadfast may supply starting values for any of them; anything it omits still shows at zero. Pure
// domain logic over the stored `assets.coinage` array — SteadingAssets owns the persistence. The stored
// order is irrelevant because `entries` always re-emits in STANDARD order.
export class Coinage {
	static STANDARD = ["silver", "gold"];

	// The full standard set as Currency entities, overlaying stored starting values by title.
	static entries(stored = []) {
		const byTitle = new Map(stored.map(raw => [raw.title, Currency.fromRaw(raw)]));
		return Coinage.STANDARD.map(title => byTitle.get(title) ?? Currency.of(title));
	}

	// Upsert one currency into the stored array by title (create if absent), leaving others untouched.
	static withUpdated(stored = [], currency) {
		const others = stored.filter(raw => raw.title !== currency.title);
		return [...others, currency.toJSON()];
	}
}
