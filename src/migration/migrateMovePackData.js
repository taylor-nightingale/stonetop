import { info } from "../utils/logger.js";

// Refresh an embedded move's authored fields from the pack.
//
// An embedded move is a copy taken when it was seeded or granted, so regenerating the pack never
// reaches an actor already in play: prose corrected later never shows, links added to a move
// (Death's Door → the Revenant/Ghost/Thrall inserts) stay unclickable, and a procedure added to a
// move (the Seasons Change steps) is missing on every steading created before it. Reference moves
// can't be re-added by hand — they seed once, at creation — so refreshing in place is the only
// route open to an existing actor.
//
// Not character-specific: characters and steadings both carry embedded copies of pack moves, and
// both go stale the same way.
//
// Authored fields come from the pack (matched by slug); player state is preserved by omission —
// acquired, instanceCount, categoryKey/Label/Note, sortOrder, compendiumId and pickValues all
// survive Foundry's merge. `name` is deliberately left alone so a GM rename is not clobbered.
// Scoped to moves the repo knows, so homebrew moves are skipped; a GM's hand-edits to a PACK move on
// an actor are overwritten, the same trade the possession/arcana refreshes already make.
export async function migrateMovePackData(actor, moveRepo) {
	const items = [...actor.items].filter(i => i.type === "move" && i.system?.slug);
	if (!items.length) return;

	const bySlug = await moveRepo.buildSlugIndex();
	const updates = [];
	for (const item of items) {
		const move = bySlug.get(item.system.slug);
		if (!move) continue;
		// The index carries a subset of fields; the definition has to come from the document itself so
		// nothing authored (xpOnMiss, result tiers, steps) is silently dropped on the way through.
		const doc = await moveRepo.getReferencedMoveDocument(move.id);
		const sys = doc?.toObject?.().system ?? doc?.system ?? null;
		if (!sys) continue;
		updates.push({
			_id: item._id,
			// The pack's art, so a move whose icon changed — or was REMOVED, which is what happened to
			// the four Seasons Change moves — actually reaches a world already in play. `name` stays
			// untouched below so a GM rename survives; an icon is not a rename, and every move in the
			// pack now carries none, so this resets them all to the one default they already share.
			img: doc.img ?? null,
			system: {
				description: sys.description ?? "",
				moveResults: sys.moveResults ?? null,
				rollStat:    sys.rollStat    ?? null,
				requirement: sys.requirement ?? null,
				resource:    sys.resource    ?? null,
				choices:     sys.choices     ?? null,
				repeatMax:   sys.repeatMax   ?? 1,
				// The move's own procedure — the Seasons Change steps. Added to the pack after
				// steadings were already in play, so an unrefreshed copy carries [] and the Season
				// tab falls back to a single "roll it".
				steps:       sys.steps       ?? [],
				// What the move does to the character's gear — Armored's shield. Authored after
				// characters were already in play, so an unrefreshed copy carries [] and a Heavy who
				// took Armored still marks ◇◇ for a shield.
				outfitEffects: sys.outfitEffects ?? [],
				// The reference category a move belongs to (seasons/homefront/basic/…). It decides
				// which section of a sheet the move is drawn in, so a stale one files it wrongly.
				moveType:    sys.moveType    ?? null,
				// "Mark XP on a 6- unless the move says otherwise" — a move says otherwise with false.
				xpOnMiss:    sys.xpOnMiss !== false,
			},
		});
	}
	if (!updates.length) return;

	info(`Refreshing ${updates.length} embedded move(s) from pack data.`);
	await actor.updateEmbeddedDocuments("Item", updates);
}
