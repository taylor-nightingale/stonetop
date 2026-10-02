/**
 * Give every custom world improvement what the editor needs it to have stored.
 *
 * - A slug. The catalog namespaces each improvement's track values by it; the improvement sheet used
 *   to mint one while it rendered, which left any improvement nobody had opened without one.
 * - A requirement rule. Before 1.6.0 an improvement was finished when all its boxes were ticked;
 *   since, a missing rule reads as "requires nothing", which finished it before a single box was
 *   ticked. The rule written is the one it always meant: every tracked row.
 *
 * Only fills gaps — a slug or a rule already there, even one requiring nothing, is left alone.
 */
export async function migrateWorldImprovementRules() {
	const updates = [];
	for (const item of game.items ?? []) {
		if (item.type !== "improvement") continue;
		const system = {};
		if (!item.system?.slug) {
			const slug = `custom-improvement-${foundry.utils.randomID(8)}`;
			system.slug = slug;
			if (!item.system?.choices) system.choices = { slug, list: [] };
		}
		const tracked = (item.system?.choices?.list ?? []).filter(row => row?.slug && row?.track).map(row => row.slug);
		if (item.system?.requires == null && tracked.length) system.requires = { all: tracked };
		if (Object.keys(system).length) updates.push({ _id: item.id, system });
	}
	if (updates.length) await Item.updateDocuments(updates);
}
