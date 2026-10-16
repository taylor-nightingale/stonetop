// The roll mode used to be kept on the actor, set from a picker on the sheet; every roll asks for it
// now (RollModeDialog). The steading's schema also declared a `system.rollMode` that nothing read.
// Schema cleaning hides that field from the in-memory source, so it is deleted unasked — a no-op
// once it has landed, like migrateSteadingContent's.
export async function migrateRollMode(actor) {
	if (actor.getFlag("stonetop", "rollMode") != null) await actor.unsetFlag("stonetop", "rollMode");
	if (actor.type === "steading") await actor.update({ "system.-=rollMode": null });
}
