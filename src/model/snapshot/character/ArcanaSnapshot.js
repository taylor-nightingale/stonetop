import { rich } from "../RichText.js";

// An arcanum side's inline ◇ item, shaped like an OutfitItemSnapshot so it renders through the shared
// outfit-item-row partial. `slug` is the ARCANUM slug (the checkbox/resource toggle keyed by it), and
// `checked` is the arcanum's owned/checked state. `resolvedResource` undefined → use the item's own raw
// resource (front); pass a built resource (or null) to override it (back). Shared by both side builders.
export function arcanumOutfitItemSnapshot(slug, itemData, resolvedResource = undefined, checked = false) {
	if (!itemData) return null;
	return {
		slug,
		name:            itemData.name,
		weight:          itemData.weight ?? null,
		tags:            rich(itemData.tags ?? null),
		note:            rich(itemData.note ?? null),
		inventoryColumn: itemData.inventoryColumn ?? null,
		twoCol:          itemData.twoCol ?? false,
		resource:        resolvedResource !== undefined ? resolvedResource : (itemData.resource ?? null),
		checked,
		isCustom:        false,
		ownedId:         null,
	};
}

// ── Front / back snapshots ────────────────────────────────────────────────────

export class ArcanumFrontSnapshot {
	constructor(b) {
		this.title       = b._title;
		this.item        = b._item;
		this.tags        = b._tags ?? null;
		this.description = b._description;
		this.unlock      = b._unlock;
	}
}

export class ArcanumFrontSnapshotBuilder {
	withTitle(v)       { this._title       = v; return this; }
	withItem(v)        { this._item        = v; return this; }
	withTags(v)        { this._tags        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withUnlock(v)      { this._unlock      = v; return this; }
	build()            { return new ArcanumFrontSnapshot(this); }

	static fromFront(front, slug, ctx) {
		return new ArcanumFrontSnapshotBuilder()
			.withTitle(rich(front.title))
			.withItem(arcanumOutfitItemSnapshot(slug, front.item, undefined, ctx.checked))
			.withTags(front.tags)
			.withDescription(rich(front.description))
			.withUnlock(ctx.group(front.unlock))
			.build();
	}
}

export class ArcanumBackSnapshot {
	constructor(b) {
		this.title       = b._title;
		this.item        = b._item;
		this.description = b._description;
		this.resource    = b._resource;
		this.choices     = b._choices  ?? [];   // ChoiceGroup[] — spells / moves / followers / consequences
		this.unlockAt    = b._unlockAt ?? null;
	}
}

export class ArcanumBackSnapshotBuilder {
	withTitle(v)       { this._title       = v; return this; }
	withItem(v)        { this._item        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withResource(v)    { this._resource    = v; return this; }
	withChoices(v)     { this._choices     = v; return this; }
	withUnlockAt(v)    { this._unlockAt    = v; return this; }
	build()            { return new ArcanumBackSnapshot(this); }

	/** The back is an ordered array of choice groups; each resolves through `ctx.group`. Moves inside a
	 *  group are move-grant entries, resolved inline against `moves.bySlug` by the template. */
	static fromBack(back, slug, ctx) {
		return new ArcanumBackSnapshotBuilder()
			.withTitle(rich(back.title))
			.withItem(arcanumOutfitItemSnapshot(slug, back.item, ctx.itemResource(back.item?.resource ?? null), ctx.checked))
			.withDescription(rich(back.description))
			.withResource(ctx.resource(back.resource ?? null))
			.withChoices((back.choices ?? []).map(g => ctx.group(g)))
			.withUnlockAt(back.unlockAt)
			.build();
	}
}

// ── Arcanum ───────────────────────────────────────────────────────────────────

export class ArcanumSnapshot {
	constructor(b) {
		this.slug    = b._slug;
		this.major   = b._major   ?? false;
		this.name    = b._name    ?? null;
		this.img     = b._img     ?? null;
		this.front   = b._front;
		this.back    = b._back;
		this.owned   = b._owned;
		this.flipped = b._flipped;
		this.checked = b._checked;
	}
}

export class ArcanumSnapshotBuilder {
	withSlug(v)    { this._slug    = v; return this; }
	withMajor(v)   { this._major   = v; return this; }
	withName(v)    { this._name    = v; return this; }
	withImg(v)     { this._img     = v; return this; }
	withFront(v)   { this._front   = v; return this; }
	withBack(v)    { this._back    = v; return this; }
	withOwned(v)   { this._owned   = v; return this; }
	withFlipped(v) { this._flipped = v; return this; }
	withChecked(v) { this._checked = v; return this; }
	build()        { return new ArcanumSnapshot(this); }

	/** The full render snapshot for one arcanum card — used by both the character sheet and the item
	 *  sheet's live preview. */
	static fromArcanum(arcanum, ctx) {
		return new ArcanumSnapshotBuilder()
			.withSlug(arcanum.slug)
			.withMajor(arcanum.major)
			.withName(arcanum.name)
			.withImg(arcanum.img)
			.withFront(ArcanumFrontSnapshotBuilder.fromFront(arcanum.front, arcanum.slug, ctx))
			.withBack(ArcanumBackSnapshotBuilder.fromBack(arcanum.back, arcanum.slug, ctx))
			.withOwned(ctx.owned)
			.withFlipped(ctx.flipped)
			.withChecked(ctx.checked)
			.build();
	}
}

// ── Sections ──────────────────────────────────────────────────────────────────

export class ArcanaSectionSnapshot {
	constructor(title, items) {
		this.title = title;
		this.items = items;
	}

	get hasOwned() { return this.items.some(i => i.owned); }
}

export class ArcanaSnapshot {
	constructor(minor, major) {
		this.minor = minor;
		this.major = major;
	}
}
