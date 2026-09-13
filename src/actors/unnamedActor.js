// True when nothing actually named this actor. Foundry's create dialog never persists an empty name:
// leave the box blank and it substitutes the document's default name — the localized type label,
// disambiguated as "Steading (2)" when one by that label already exists. So a placeholder name is the
// only signal we get that the creator did not choose one, and the seeding paths that would otherwise
// clobber a chosen name (StonetopSteading's steadfast seed) ask this before naming the actor themselves.
export function isUnnamedActor(actor) {
	const name = (actor?.name ?? "").trim();
	if (!name) return true;
	const labelKey = globalThis.CONFIG?.Actor?.typeLabels?.[actor.type] ?? `TYPES.Actor.${actor.type}`;
	const label = globalThis.game?.i18n?.localize(labelKey) ?? labelKey;
	return name.replace(/ \(\d+\)$/, "") === label;
}
