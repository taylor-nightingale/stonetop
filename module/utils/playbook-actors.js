// Shared "player character" helpers. Only player characters carry a playbook, so
// "has a playbook" is the system-wide test for which actors are PCs — used by the
// Introductions and Let-Spring-Burst walkthroughs, the playbook picker, and the
// character sheet's avatar art.

/**
 * A character's playbook slug, from either the embedded `system.playbook` data or
 * a contained playbook item. Returns "" when there's no playbook yet — which also
 * makes it the truthiness test for "is this actor a player character".
 */
export function playbookSlug(actor) {
	return actor?.system?.playbook?.slug
		?? actor?.items?.find?.(i => i.type === "playbook")?.system?.slug
		?? "";
}

/** Every world actor that is a player character (a `character` with a playbook). */
export function getPlayerCharacters() {
	return (game.actors?.contents ?? []).filter(a => a.type === "character" && playbookSlug(a));
}

/**
 * The given actors ordered by the combat tracker's turn order — `combat.turns`
 * (honouring how the GM arranged the table), or the raw combatants before turns
 * are rolled. De-duped by id; actors not on the tracker are dropped, so the result
 * is the intersection of `actors` with the tracker, in turn order. Returns [] when
 * no combat is set up. Pass `getPlayerCharacters()` to order the PC roster.
 */
export function orderByCombatTurns(actors) {
	const combat = game.combat;
	if (!combat) return [];
	// `turns` honours how the GM arranged the table; before turns are built, fall
	// back to the raw combatants — spread to an array (combat.combatants is a
	// Foundry Collection, which has `.size`, not `.length`) so the guard + iteration
	// below work the same for both.
	const order  = combat.turns?.length ? combat.turns : [...combat.combatants];
	if (!order.length) return [];
	const byId   = new Map(actors.map(a => [a.id, a]));
	const seen   = new Set();
	const result = [];
	for (const c of order) {
		const actor = byId.get(c.actorId ?? c.actor?.id);
		if (actor && !seen.has(actor.id)) { seen.add(actor.id); result.push(actor); }
	}
	return result;
}

/**
 * Every `character` the given user explicitly owns — using the per-user OWNER
 * entry, not a GM's blanket ownership, so it returns only the PCs actually
 * assigned to that player.
 */
export function charactersOwnedBy(userId) {
	const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
	return (game.actors?.contents ?? []).filter(
		a => a.type === "character" && (a.ownership?.[userId] ?? 0) >= owner,
	);
}

/**
 * Path to a playbook's avatar art (`assets/icons/playbooks/<slug>_icon.webp`), or
 * `null` for a slug-less actor. Server-root-relative (no leading slash) — the same
 * string stored as the character's avatar on pick, so previews match the art.
 */
export function playbookIconPath(slug) {
	return slug
		? `systems/stonetop/assets/icons/playbooks/${slug.replace(/-/g, "_")}_icon.webp`
		: null;
}
