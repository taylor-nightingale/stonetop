const SCOPE = "stonetop";

export async function migrateNpc(actor) {
	const hp = actor.getFlag(SCOPE, "npc.hp");
	if (hp == null) return;

	const f = key => actor.getFlag(SCOPE, key);
	const hpVal = f("npc.hp")    ?? 0;
	const hpMax = f("npc.maxHp") ?? 0;
	await actor.update({
		"system.hp":             { value: hpVal, max: hpMax > 0 ? hpMax : hpVal },
		"system.armor":          String(f("npc.armor") ?? 0),
		"system.damage":         f("npc.damage")         ?? "",
		"system.specialQuality": f("npc.specialQuality") ?? "",
		"system.instinct":       f("npc.instinct")       ?? "",
		"system.description":    f("npc.description")    ?? "",
	});
}
