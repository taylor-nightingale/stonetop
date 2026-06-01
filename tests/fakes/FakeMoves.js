export class FakeMoves {
	_counts = {};

	ownMove(name, count = 1) { this._counts[name] = count; return this; }
	countOwnedByName(name)   { return this._counts[name] ?? 0; }
}
