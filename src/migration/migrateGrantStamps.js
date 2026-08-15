import { GrantStamp } from "../model/data/ItemGrant.js";
import { legacyGrantStamp } from "./legacyGrantStamp.js";
import { DuplicateGrantPruner } from "./DuplicateGrantPruner.js";
import { info } from "../utils/logger.js";

/**
 * Give every item an existing world granted the stamp the running system now reads, then delete the
 * duplicates the old grant paths left behind.
 *
 * Both halves are one migration because the second needs the first: duplicates are only recognisable
 * once every copy says what granted it. Runs for characters and steadings; safe to re-run, since a
 * stamped item is skipped and an unduplicated world is a no-op.
 */
export async function migrateGrantStamps(actor) {
	const updates = [];
	for (const item of actor.items ?? []) {
		if (GrantStamp.of(item)) continue;
		const stamp = legacyGrantStamp(item);
		if (!stamp) continue;   // authored items stay unstamped: nobody granted them, nobody revokes them
		updates.push({ _id: item._id, flags: { stonetop: { grant: { source: stamp.source, key: stamp.key } } } });
	}
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);

	const pruned = await new DuplicateGrantPruner(actor).prune();
	if (pruned.length) info(`  [grants] ${actor.name}: removed ${pruned.length} duplicate granted item(s)`);
	return { stamped: updates.length, pruned: pruned.length };
}
