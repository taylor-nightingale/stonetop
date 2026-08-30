// The immutable baseline a steading's ratings started from — copied off the steadfast on apply, so
// it survives in-play edits and lets a tile show how far a rating has travelled ("was +0").
// Null until a steadfast is applied, so a blank steading shows no history it doesn't have.
export function startingValue(actor, slug) {
	if (!actor.system?.steadfast) return null;
	const value = actor.system.startingAttributes?.[slug];
	if (value == null || (slug === "size" && value === "")) return null;
	return value;
}
