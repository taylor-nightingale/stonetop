export async function onReady() {
	await _migrateArmourToArmor();
}

async function _migrateArmourToArmor() {
	const staleActors = game.actors.filter(
		a => a.type === "character" && a.system?.attributes?.armour !== undefined
	);
	if (!staleActors.length) return;
	for (const actor of staleActors) {
		await actor.update({ "system.attributes.-=armour": null });
	}
}
