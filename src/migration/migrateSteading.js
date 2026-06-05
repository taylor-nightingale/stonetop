const SCOPE = "stonetop";

export async function migrateSteading(actor) {
	const pickValues = actor.getFlag(SCOPE, "improvements.pickValues");
	if (pickValues == null) return;

	await actor.update({ "system.improvements.pickValues": pickValues });
}
