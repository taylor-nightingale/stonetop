import { rich } from "../RichText.js";
import { Tags } from "../../data/Tags.js";

// An arcanum side's inline ◇ item, shaped like an OutfitItemSnapshot so it renders through the shared
// outfit-item-row partial. `slug` is the ARCANUM slug (the checkbox/resource toggle keyed by it), and
// `checked` is the arcanum's owned/checked state. `resolvedResource` undefined → use the item's own raw
// resource; pass a built resource (or null) to override it. Shared by both side builders.
export function arcanumOutfitItemSnapshot(slug, itemData, resolvedResource = undefined, checked = false) {
	if (!itemData) return null;
	return {
		slug,
		name:            itemData.name,
		weight:          itemData.weight ?? null,
		tags:            Tags.gear(itemData.tags).resolved,
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

// ArcanumFront and ArcanumBack are authored differently but RENDER as the same card: header chrome
// (title/item/tags/resource) above a body that is an ordered array of choice groups. So both build into
// this one side snapshot — only where the heading comes from differs (see the two factories below). A
// move/follower grant or a □ track is just an entry; the old description is a content entry in a group.
export class ArcanumSideSnapshot {
	constructor(b) {
		this.title    = b._title;
		this.item     = b._item;
		this.tags     = b._tags ?? [];
		this.resource = b._resource;
		this.choices  = b._choices ?? [];   // ChoiceGroup[]
	}
}

export class ArcanumSideSnapshotBuilder {
	withTitle(v)    { this._title    = v; return this; }
	withItem(v)     { this._item     = v; return this; }
	withTags(v)     { this._tags     = v; return this; }
	withResource(v) { this._resource = v; return this; }
	withChoices(v)  { this._choices  = v; return this; }
	build()         { return new ArcanumSideSnapshot(this); }

	/** The front's heading is the ARCANUM's name — a front has no title of its own. */
	static fromFront(front, name, slug, ctx) {
		return ArcanumSideSnapshotBuilder.#build(front, rich(name), slug, ctx);
	}

	/** The back's heading is its own authored title — the mystery's name. */
	static fromBack(back, slug, ctx) {
		return ArcanumSideSnapshotBuilder.#build(back, rich(back.title), slug, ctx);
	}

	/** Each choice group resolves through `ctx.group`; inline move/follower grants resolve against
	 *  `moves.bySlug` / `followers.bySlug` in the template. */
	static #build(side, title, slug, ctx) {
		return new ArcanumSideSnapshotBuilder()
			.withTitle(title)
			.withItem(arcanumOutfitItemSnapshot(slug, side.item, ctx.resource(side.item?.resource ?? null), ctx.checked))
			.withTags(Tags.gear(side.tags).resolved)
			.withResource(ctx.resource(side.resource ?? null))
			.withChoices((side.choices ?? []).map(g => ctx.group(g)))
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
			.withFront(ArcanumSideSnapshotBuilder.fromFront(arcanum.front, arcanum.name, arcanum.slug, ctx))
			.withBack(ArcanumSideSnapshotBuilder.fromBack(arcanum.back, arcanum.slug, ctx))
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

	/** Owned in either section — what the tab's "drag arcana here" note is gated on. */
	get hasOwned() { return this.minor.hasOwned || this.major.hasOwned; }
}
