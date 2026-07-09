// The "Starts at …" note shown under a steading attribute. It reads the immutable startingAttributes
// baseline (copied from the steadfast on apply, so it survives in-play edits to the live rating),
// formats the value per attribute, and fills the translatable `stonetop.steading.startsAt` template.
// Empty until a steadfast is applied, so the note stays hidden on a blank steading.

// Format a starting value for display: size is a named tier (emphasised), surplus a raw count, and the
// ±N ratings are signed (including +0) — matching the roll-display convention (ActorRolling.js).
export function formatStartingValue(slug, value) {
	if (slug === "size")    return `<em>${value}</em>`;
	if (slug === "surplus") return `${value}`;
	return `${value >= 0 ? "+" : ""}${value}`;
}

export function startingAttributeNote(actor, slug) {
	if (!actor.system?.steadfast) return "";
	const value = actor.system.startingAttributes?.[slug];
	if (value == null || (slug === "size" && value === "")) return "";
	return game.i18n.format("stonetop.steading.startsAt", { value: formatStartingValue(slug, value) });
}
