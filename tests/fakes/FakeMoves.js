export class FakeMoves {
	_counts      = {};
	_incremented = [];
	_decremented = [];
	_initialized = null;
	_removedCategories   = [];
	_addedCategories     = [];
	_snapshotsByCategory = {};

	ownMove(slug, count = 1)  { this._counts[slug] = count; return this; }
	countOwnedBySlug(slug)    { return this._counts[slug] ?? 0; }

	async incrementMove(catKey, moveSlug) { this._incremented.push([catKey, moveSlug]); }
	async decrementMove(catKey, moveSlug) { this._decremented.push([catKey, moveSlug]); }
	async initPlaybookCategory(data)      { this._initialized = data; }

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

	async addCategory(type, name, slug, moveSlugs = []) { this._addedCategories.push({ type, name, slug, moveSlugs }); }
	async removeCategory(type)          { this._removedCategories.push(type); }

	setSnapshotsForCategory(category, snapshots) { this._snapshotsByCategory[category] = snapshots; }
	getMoveSnapshotsForCategory(type) { return this._snapshotsByCategory[type] ?? []; }
}
