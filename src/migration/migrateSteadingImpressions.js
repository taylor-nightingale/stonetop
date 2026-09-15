import { loadSteadfast } from "../actors/steading/applySteadfast.js";
import { Impressions } from "../model/data/steading/Impressions.js";
import { Seasons } from "../model/data/steading/Seasons.js";

// The book's per-season "Impressions" lines are part of a steading's DEFINITION — they describe the
// place, not what has happened to it — so they live on the steadfast and are copied onto the actor
// when it is applied. Every steading created before that field existed has an empty list and no line
// to show, which is a gap in a definition rather than a record the table wrote.
//
// So: re-copy the definition, and stamp the current season if nothing has stamped one yet. The
// stamp is left alone once set, because by then it is a record — the line THIS season was given,
// which the season band goes on showing until the wheel turns.
//
// Ungated and idempotent, like the other steading passes: the runner only fires when the world's
// stored version is behind the system's, and re-running copies the same lines back.
export async function migrateSteadingImpressions(actor) {
	const steadfast = actor.system?.steadfast ? await loadSteadfast(actor.system.steadfast) : null;
	const defined = steadfast?.system?.impressions ?? [];
	if (!defined.length) return;

	const update = { "system.impressions": defined.map(row => ({ ...row })) };

	// Only when absent: a steading that has already turned a season carries the line it was given,
	// and re-rolling it here would quietly change what the table has been reading all season.
	if (!actor.system?.seasonImpression) {
		const line = Impressions.fromRaw(defined).pickFor(Seasons.byKey(actor.system?.season));
		if (line) update["system.seasonImpression"] = line;
	}

	await actor.update(update);
}
