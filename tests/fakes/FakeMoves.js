import { GrantSource, ItemGrant, ItemGrantSet } from "../../src/model/data/ItemGrant.js";

export class FakeMoves {
	_counts      = {};
	_incremented = [];
	_decremented = [];
	_initialized = null;
	_removedCategories   = [];
	_addedCategories     = [];
	_snapshotsByCategory = {};

	_tracks = {};

	ownMove(slug, count = 1)  { this._counts[slug] = count; return this; }
	countOwnedBySlug(slug)    { return this._counts[slug] ?? 0; }

	// A move that carries a track (Thrall's Favor), at the given current value.
	withTrack(slug, value)    { this._tracks[slug] = value; return this; }
	resourceValue(slug)       { return this._tracks[slug] ?? null; }

	async incrementMove(catKey, moveSlug) { this._incremented.push([catKey, moveSlug]); }
	async decrementMove(catKey, moveSlug) { this._decremented.push([catKey, moveSlug]); }
	async initPlaybookCategory(data)      { this._initialized = data; }

	// The grant set CharacterPlaybook asks for; records the extra starting slugs it was told about
	// (the chosen background's moves).
	async playbookGrants(data, alsoStarting = []) {
		this._initialized  = data;
		this._alsoStarting = [...alsoStarting];
		return ItemGrantSet.empty(GrantSource.playbook(data.slug));
	}

	alsoStarting() { return this._alsoStarting ?? []; }

	wasIncremented(catKey, moveSlug) {
		return this._incremented.some(([k, s]) => k === catKey && s === moveSlug);
	}

	wasDecremented(catKey, moveSlug) {
		return this._decremented.some(([k, s]) => k === catKey && s === moveSlug);
	}

	incrementedCount()  { return this._incremented.length; }
	initializedWith()   { return this._initialized; }

	get removedCategories() { return this._removedCategories; }
	get addedCategories()   { return this._addedCategories; }

	async addCategory(type, name, moveSlugs = []) { this._addedCategories.push({ type, name, moveSlugs }); }

	// The grant set a source (insert/arcanum) asks for. Recorded like addCategory so a test can assert
	// what was granted without knowing whether the caller applied it itself or handed it to the router.
	async categoryGrants(type, name, moveSlugs = [], startingSlugs = []) {
		this._addedCategories.push({ type, name, moveSlugs });
		return new ItemGrantSet(
			GrantSource.forCategoryKey(type),
			moveSlugs.map(slug => new ItemGrant({ name: slug, type: "move", system: { slug } })),
		);
	}
	async removeCategory(type)          { this._removedCategories.push(type); }

	setSnapshotsForCategory(category, snapshots) { this._snapshotsByCategory[category] = snapshots; }
	getMoveSnapshotsForCategory(type) { return this._snapshotsByCategory[type] ?? []; }
}
