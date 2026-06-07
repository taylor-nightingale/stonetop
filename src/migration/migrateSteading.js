const SCOPE = "stonetop";

export async function migrateSteading(actor) {
	const update = {};

	const pickValues = actor.getFlag(SCOPE, "improvements.pickValues");
	if (pickValues != null) update["system.improvements.pickValues"] = pickValues;

	const residents = actor.getFlag(SCOPE, "steading.residents");
	if (residents != null) update["system.residents"] = residents;

	const neighborPeople = actor.getFlag(SCOPE, "steading.neighborPeople");
	if (neighborPeople != null) update["system.neighborPeople"] = neighborPeople;

	if (Object.keys(update).length) await actor.update(update);
}
