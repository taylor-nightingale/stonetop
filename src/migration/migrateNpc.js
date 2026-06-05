const SCOPE = "stonetop";

export async function migrateNpc(actor) {
	const hp = actor.getFlag(SCOPE, "npc.hp");
	if (hp == null) return;

	const f = key => actor.getFlag(SCOPE, key);
	await actor.update({
		"system.hp":             f("npc.hp")             ?? 0,
		"system.maxHp":          f("npc.maxHp")          ?? 0,
		"system.armor":          f("npc.armor")          ?? 0,
		"system.damage":         f("npc.damage")         ?? "d6",
		"system.specialQuality": f("npc.specialQuality") ?? "",
		"system.instinct":       f("npc.instinct")       ?? "",
		"system.description":    f("npc.description")    ?? "",
	});
}
