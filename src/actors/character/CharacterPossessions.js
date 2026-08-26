import {
	PossessionItemSnapshotBuilder,
	PossessionsSnapshot,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ResourceController } from "./ResourceController.js";
import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { buildChoiceGroup } from "../../model/snapshot/character/buildChoiceGroup.js";
import { Possession } from "../../model/data/character/Possession.js";
import { OutfitGrant } from "../../model/data/character/OutfitGrant.js";
import { rich } from "../../model/snapshot/RichText.js";
import { GrantedItems } from "../GrantedItems.js";
import { GrantSource, GrantStamp, ItemGrant, ItemGrantSet } from "../../model/data/ItemGrant.js";

export class CharacterPossessions {
	// `factory` is required: a locally-constructed one would carry no registered side-effect handlers,
	// so every choice group on the sheet would silently stop granting.
	constructor(actor, moves, possessionRepo = null, factory, containerOutfitSync = null,
	            grantedItems = new GrantedItems(actor)) {
		this._actor          = actor;
		this._moves          = moves;
		this._possessionRepo = possessionRepo;
		this._factory        = factory;
		this._outfitSync     = containerOutfitSync;
		this._grantedItems   = grantedItems;
	}

	// A possession's sub-choices ARE a choice group: values persist through the shared controller, and
	// the gear they grant is written by ContainerOutfitSync like any other container. The namespace is
	// the possession slug — the key the stored pickValues already use — so no data is rewritten.
	_pickController(itemId) {
		return this._factory.forDocument(itemId, "pickValues");
	}

	get selected() {
		return new Set(
			[...this._actor.items]
				.filter(i => i.type === "possession" && i.system?.selected)
				.map(i => i.system?.slug)
				.filter(Boolean),
		);
	}

	async select(slug) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { selected: true } }]);
		await this.syncPossessionItems(slug);
	}

	// Deselecting takes the gear back through the same sync a tick uses: an unselected possession
	// grants nothing, so recomputing IS the clear. One path, so the two can never disagree.
	async deselect(slug) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { selected: false } }]);
		await this.syncPossessionItems(slug);
	}

	// Remove a drag-dropped (non-playbook) possession entirely, along with any outfit items it granted.
	async deletePossession(slug) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._outfitSync?.clear("possession:" + slug);
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	async setUses(slug, count) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { uses: count } }]);
	}

	/** The controller for one possession's picks, or null when the possession is not embedded. */
	controllerFor(possessionSlug) {
		const item = _findPossessionItem(this._actor, possessionSlug);
		return item ? this._pickController(item._id) : null;
	}

	async setChoiceUses(possessionSlug, choiceSlug, count) {
		const item = _findPossessionItem(this._actor, possessionSlug);
		if (!item) return;
		const current = item.system?.choiceUses ?? {};
		await this._actor.updateEmbeddedDocuments("Item", [{
			_id: item._id,
			system: { choiceUses: { ...current, [choiceSlug]: count } },
		}]);
	}

	async addPossessionsFromPlaybook(sp, playbookSlug) {
		const created = await this._grantedItems.sync(await this.playbookGrants(sp, playbookSlug));
		for (const item of created) await this.onCreated(item);
	}

	// Only a possession that arrives already selected brings its gear with it; the rest grant theirs when
	// the player ticks them. Ignores anything that isn't a possession, so a caller can hand it every item
	// a grant created without sorting them first.
	async onCreated(item) {
		if (item?.type !== "possession" || !item.system?.preselected) return;
		await this.syncPossessionItems(item.system.slug);
	}

	/** Every possession this playbook wants the character to own, keyed by slug. Which of the character's
	 *  possessions are the playbook's picks is the grant stamp's business, not a field of their own. */
	async playbookGrants(sp, playbookSlug) {
		const source = GrantSource.playbook(playbookSlug);
		if (!sp || !this._possessionRepo) return ItemGrantSet.empty(source);
		const { preselected = [], slugs = [] } = sp;
		const preselectedSet = new Set(preselected);
		const possessions = await this._possessionRepo.findBySlugs(slugs);
		const grants = possessions.map(possession => {
			const slug = possession.slug;
			return new ItemGrant({
				name: possession.name, type: "possession",
				system: {
					slug:         possession.slug,
					description:  possession.description,
					resource:     possession.resource,
					outfitItems:  possession.outfitItems,
					choices:      possession.choices,
					scaling:      possession.scaling,
					sortOrder:    possession.sortOrder,
					selected:     preselectedSet.has(slug),
					preselected:  preselectedSet.has(slug),
					uses:         0,
					pickValues:   {},
					choiceUses:   {},
				},
			});
		});
		return new ItemGrantSet(source, grants);
	}

	// The gear a granted possession put in the outfit is keyed by the possession, not the playbook, so
	// revoking the playbook has to name each of those sources before the possessions themselves go.
	async clearGrantedOutfit(source) {
		const gear = this._grantedItems.itemsFrom(source)
			.filter(item => item.type === "possession")
			.map(item => "possession:" + item.system?.slug);
		await this._outfitSync?.clearAll(gear);
	}

	/** What a possession grants right now: its own gear plus whatever its ticked choices grant — and
	 *  nothing at all until the player has taken it. The gate lives here rather than in the callers
	 *  because every one of them (a tick, a selection, a pack refresh, a migration) has to honour it,
	 *  and a migration that didn't once handed every character the gear of possessions nobody picked. */
	static outfitGrantFor(item) {
		const possession = new Possession(item.system);
		const source     = "possession:" + possession.slug;
		if (!possession.selected) return OutfitGrant.empty(source);
		return OutfitGrant.forContainer(
			source,
			possession.outfitItems ?? [],
			item.system,
			item.system?.pickValues ?? {},
		);
	}

	async syncPossessionItems(slug) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._outfitSync?.syncItem(item);
	}

	computeMaxUses(possessions, level) {
		const result = {};
		for (const p of possessions) {
			if (!p.scaling) continue;
			let bonus = 0;
			if (p.scaling.perEvenLevel) bonus += Math.floor(level / 2) * p.scaling.perEvenLevel;
			for (const mb of (p.scaling.perMove ?? [])) {
				bonus += this._moves.countOwnedBySlug(mb.moveSlug) * mb.amount;
			}
			if (bonus > 0) result[p.slug] = (p.resource?.max ?? 0) + bonus;
		}
		return result;
	}

	async buildSnapshot(actorLevel) {
		const playbookItem = [...this._actor.items].find(i => i.type === "playbook");
		const sp = playbookItem?.system?.specialPossessions ?? null;
		if (!sp) return null;
		const { pickNote, pickCount } = sp;

		const possessionItems = [...this._actor.items].filter(i => i.type === "possession");
		const playbookItems   = possessionItems.filter(i => GrantSource.isPlaybook(GrantStamp.of(i)?.source));
		const playbookSlugSet = new Set(playbookItems.map(i => i.system?.slug).filter(Boolean));
		const embeddedItems   = possessionItems.filter(
			i => !playbookItems.includes(i) && !playbookSlugSet.has(i.system?.slug),
		);

		const possessions = playbookItems.map(item => new Possession(item.system));
		const maxUsesMap  = this.computeMaxUses(possessions, actorLevel);

		const items = playbookItems.map(item => {
			const p          = new Possession(item.system);
			const isSelected = item.system?.selected ?? false;
			const isPre      = item.system?.preselected ?? false;
			const maxUses    = maxUsesMap[p.slug] ?? p.resource?.max ?? null;
			const currentUses = item.system?.uses ?? 0;
			const resourceDef = p.resource ?? null;
			const resource = resourceDef
				? ResourceController.build({ ...resourceDef, max: maxUses ?? resourceDef.max }, currentUses)
				: null;
			const pickValues = new ChoiceValues(item.system?.pickValues ?? {});
			return new PossessionItemSnapshotBuilder()
				.withSlug(p.slug)
				.withLabel(rich(item.name))
				.withDescription(rich(p.description ?? ""))
				.withSelected(isSelected)
				.withChecked(isSelected)
				.withDisabled(isPre)
				.withPreselected(isPre)
				.withPreselectedSource(isPre ? "Starting" : null)
				.withResource(resource)
				.withUsesLabel(resourceDef?.title ?? null)
				.withChoices(isSelected && p.choices ? buildChoiceGroup({ ...p.choices, slug: p.slug }, pickValues) : null)
				.build();
		});

		for (const item of embeddedItems) {
			const p = new Possession(item.system);
			const isSelected = item.system?.selected ?? false;
			const resourceDef = p.resource ?? null;
			const currentUses = item.system?.uses ?? 0;
			const resource = resourceDef
				? ResourceController.build({ ...resourceDef }, currentUses)
				: null;
			const pickValues = new ChoiceValues(item.system?.pickValues ?? {});
			items.push(new PossessionItemSnapshotBuilder()
				.withSlug(p.slug)
				.withLabel(rich(item.name))
				.withDescription(rich(p.description ?? ""))
				.withSelected(isSelected)
				.withChecked(isSelected)
				.withDisabled(false)
				.withPreselected(false)
				.withPreselectedSource(null)
				.withRemovable(true)
				.withResource(resource)
				.withUsesLabel(resourceDef?.title ?? null)
				.withChoices(p.choices ? buildChoiceGroup({ ...p.choices, slug: p.slug }, pickValues) : null)
				.build());
		}

		return new PossessionsSnapshot(pickCount, pickNote, items);
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _findPossessionItem(actor, slug) {
	return [...actor.items].find(i => i.type === "possession" && i.system?.slug === slug) ?? null;
}

