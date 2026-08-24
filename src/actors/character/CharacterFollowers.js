import { buildFollowerSnapshot } from "../../model/snapshot/character/buildFollowerSnapshot.js";
import { FollowersSnapshot } from "../../model/snapshot/character/FollowerSnapshot.js";
import { ResourceController } from "./ResourceController.js";
import { Selection } from "../../model/data/Selection.js";
import { Tags } from "../../model/data/Tags.js";
import { normalizeGroupTags, hasGroupTag, GROUP_TAG } from "../../model/data/groupTag.js";
import { newMember } from "../../utils/followerMemberEdit.js";
import { blankCompanion } from "../../utils/followerCompanionEdit.js";
import { buildOutfitColumn, loadBand, MAX_OUTFIT_MARKS } from "../../model/snapshot/character/outfitSections.js";
import { GrantedItems } from "../GrantedItems.js";
import { GrantSource, ItemGrant, ItemGrantSet } from "../../model/data/ItemGrant.js";
import { FollowerItem } from "./FollowerItem.js";
import { itemsOfType, itemOfTypeBySlug } from "../actorItems.js";

export class CharacterFollowers {
	constructor(actor, followerRepo, resourceController, factory = null, inventoryRepo = null,
	            grantedItems = new GrantedItems(actor)) {
		this._actor              = actor;
		this._followerRepo       = followerRepo;
		this._resourceController = resourceController;
		this._factory            = factory;
		this._inventoryRepo      = inventoryRepo; // shared outfit-item catalog (same as the character)
		this._grantedItems       = grantedItems;
		this._openInventories    = new Set();     // follower slugs whose inventory catalog is expanded
	}

	// Which followers have their inventory catalog open (transient sheet state, set before each
	// build). Only an open follower renders the full catalog — otherwise every card would carry the
	// whole outfit list, making tag/item edits re-render slowly.
	setOpenInventories(slugs) {
		this._openInventories = slugs instanceof Set ? slugs : new Set(slugs ?? []);
	}

	// Read-modify-write the WHOLE inventory object atomically (opaque ObjectField — the partial diff
	// must carry it intact, or Foundry's migrate-on-diff would clobber it).
	async _updateInventory(followerSlug, mutate) {
		const item = _findFollowerItem(this._actor, followerSlug);
		if (!item) return;
		const inv  = item.system?.inventory ?? {};
		const next = {
			checked:     { ...(inv.checked ?? {}) },
			customItems: [...(inv.customItems ?? [])],
			resources:   { ...(inv.resources ?? {}) },
		};
		mutate(next);
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { inventory: next } }]);
	}

	// Take/drop an item for one follower. No cap — checking is unrestricted (load is guidance).
	async setInvItemChecked(followerSlug, itemSlug, on) {
		await this._updateInventory(followerSlug, inv => { inv.checked[itemSlug] = !!on; });
	}

	// Add a custom gear item to a follower (followers can't embed Items, so it lives inline). Auto-held.
	async addInvCustomItem(followerSlug, name, weight) {
		const slug = `custom-${foundry.utils.randomID(8)}`;
		await this._updateInventory(followerSlug, inv => {
			inv.customItems.push({
				slug, name: name || "Item", weight: Math.max(1, Number(weight) || 1),
				tags: "", note: null, inventoryColumn: "regular", twoCol: false,
			});
			inv.checked[slug] = true;
		});
	}

	async removeInvCustomItem(followerSlug, itemSlug) {
		await this._updateInventory(followerSlug, inv => {
			inv.customItems = inv.customItems.filter(c => c.slug !== itemSlug);
			delete inv.checked[itemSlug];
			delete inv.resources[itemSlug];
		});
	}

	async setInvResource(followerSlug, itemSlug, count) {
		await this._updateInventory(followerSlug, inv => { inv.resources[itemSlug] = count; });
	}

	get ownedSlugs() {
		return itemsOfType(this._actor, "follower")
			.filter(i => i.system?.owned ?? false)
			.map(i => i.system?.slug)
			.filter(Boolean);
	}

	// Embed a follower as owned, or refresh an already-owned one's `showOnTab`. Idempotent: a card grants
	// ownership up front (showOnTab:false, card-only), then a mark toggles the follower onto the roster
	// (showOnTab:true) and back — the same call each time.
	async addFollower(slug, { showOnTab = true } = {}) {
		const existing = _findFollowerItem(this._actor, slug);
		if (existing) {
			const sys = existing.system ?? {};
			if (sys.owned !== true || sys.showOnTab !== showOnTab) {
				await this._actor.updateEmbeddedDocuments("Item", [{ _id: existing._id, system: { owned: true, showOnTab } }]);
			}
			return;
		}
		const [follower] = await this._followerRepo.findBySlugs([slug]);
		if (!follower) return;
		// Unstamped: this is the follower a player dropped in, or one a ticked choice row hands them
		// outright. Nothing reconciles it, and nothing takes it back on its own — only the roster's own
		// remove does. A follower that a card owns arrives through arcanumGrants instead.
		await this._grantedItems.addAuthored([_embeddedFollower(follower, { showOnTab })]);
	}

	/** Every follower this playbook wants the character to own, keyed by slug. The previous playbook's
	 *  followers leave with that playbook item, so this only ever speaks for the one it was given. */
	async playbookGrants(playbookSlug, followerSlugs = []) {
		return this._grantsFrom(GrantSource.playbook(playbookSlug), playbookSlug && followerSlugs);
	}

	async removeFollower(slug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	// The followers an arcanum's card grants: owned, but off the roster tab until a mark on the card
	// puts them there. Provenance is the stamp, so removing the card takes them back — where it used to
	// depend on `system.arcanaSlug` surviving in the pack data.
	async arcanumGrants(arcanumSlug, followerSlugs = []) {
		return this._grantsFrom(GrantSource.arcanum(arcanumSlug), arcanumSlug && followerSlugs, { showOnTab: false });
	}

	async _grantsFrom(source, followerSlugs, extraSystem = {}) {
		if (!followerSlugs?.length) return ItemGrantSet.empty(source);
		const followers = await this._followerRepo.findBySlugs(followerSlugs);
		return new ItemGrantSet(source, followers.map(f => new ItemGrant(_embeddedFollower(f, extraSystem))));
	}

	async addCustomFollower() {
		const slug = `custom-${Date.now()}`;
		const [blank] = await this._followerRepo.findBySlugs(["blank"]);
		await this._grantedItems.addAuthored([{
			name: blank?.name ?? "New Follower", type: "follower",
			...(blank?.img ? { img: blank.img } : {}),
			system: {
				slug, arcanaSlug: null, tagList: Tags.creature(blank?.tags).toRaw(), tagOptions: blank?.tagOptions ?? [], owned: true, choiceValues: {},
				hp:      { value: blank?.hp?.max ?? 6, max: blank?.hp?.max ?? 6 },
				armor:   blank?.armor ?? "",
				damage:  "",
				instinct: Selection.fromStored("").toRaw(), moves: "", cost: Selection.fromStored("").toRaw(), notes: "",
				loyalty: { value: 0, max: 3 },
				choices: blank?.choices ?? null, specialQuality: "",
			},
		}]);
	}

	async addFromNpcActor(npcActor) {
		const sys     = npcActor.system ?? {};
		const slug    = `custom-${Date.now()}`;
		const [blank] = await this._followerRepo.findBySlugs(["blank"]);
		// Canonicalize the copied group tag ("Group (3)" -> "group") so isGroup detects it, and seed
		// the crew from the "(N)" count — each member at the group's shared max HP (as addMember does).
		const tags    = Tags.creature(sys.tagList, sys.tagOptions ?? []);
		const { tags: selected, count } = normalizeGroupTags(tags.values);
		const hpMax   = (sys.hp?.max || sys.hp?.value) ?? 0;
		const members = count ? Array.from({ length: count }, () => newMember(hpMax)) : [];
		await this._grantedItems.addAuthored([{
			name: npcActor.name, type: "follower",
			...(npcActor.img ? { img: npcActor.img } : {}),
			system: {
				// creature core copied from the NPC (shared schema → direct copy)
				tagList:   selected,
				tagOptions: sys.tagOptions ?? [],
				members,
				hp:             { value: sys.hp?.value ?? 0, max: hpMax },
				armor:          sys.armor ?? "",
				damage:         sys.damage ?? "",
				specialQuality: sys.specialQuality ?? "",
				instinct:       Selection.fromStored(sys.instinct).toRaw(),
				moves:          sys.moves ?? "",
				description:    sys.description ?? "",
				notes:          sys.notes ?? "",
				reference:      sys.reference ?? null,
				// follower bookkeeping
				slug, arcanaSlug: null, owned: true,
				loyalty:        { value: 0, max: 3 },
				choices:        blank?.choices ?? [],
				choiceValues:   {},
			},
		}]);
	}

	async setHp(slug, hp) {
		await this._write(slug, f => f.withHp(hp));
	}

	async setHpMax(slug, hpMax) {
		await this._write(slug, f => f.withHpMax(hpMax));
	}

	async setName(slug, name) {
		await this._write(slug, f => f.withName(name));
	}

	async setTags(slug, tags) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item",
			[{ _id: item._id, system: { tagList: Tags.creature(tags).toRaw() } }]);
	}

	// Toggle a value in any Selection field (tags, instinct, cost). Single-select fields
	// replace; multi-select add/remove (handled by Selection.toggle).
	async toggleSelection(slug, field, value) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item || !field || !value) return;
		const stored = Selection.fromStored(item.system?.[field]).toggle(value).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { [field]: stored } }]);
	}

	// Find → reshape → one write, for every plain single-field setter above.
	async _write(slug, change) {
		const follower = FollowerItem.bySlug(this._actor, slug);
		if (!follower) return;
		await this._actor.updateEmbeddedDocuments("Item", [change(follower).toUpdate()]);
	}

	async setLoyalty(slug, loyalty) {
		await this._resourceController.set("followers", slug, loyalty);
	}

	// --- Group members: each owns its HP; the new member starts at the group's shared max. ---
	async addMember(slug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const max = item.system?.hp?.max ?? 0;
		const blank = { name: "", hp: { value: max, max }, tags: [], traits: [] };
		const members = [..._members(item), blank];
		// Adding a member makes this a group follower — ensure a group tag is set (FollowerSnapshot.isGroup).
		// A follower already tagged "horde" IS a group, so it keeps its own word rather than gaining both.
		const tags    = Tags.creature(item.system?.tagList);
		const tagList = (hasGroupTag(tags) ? tags : tags.select(GROUP_TAG)).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { members, tagList } }]);
	}

	async removeMember(slug, index) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const members = _members(item);
		if (index < 0 || index >= members.length) return;
		members.splice(index, 1);
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { members } }]);
	}

	async setMemberName(slug, index, name)  { await this._updateMember(slug, index, m => ({ ...m, name })); }
	async setMemberHp(slug, index, value)   { await this._updateMember(slug, index, m => ({ ...m, hp: { ...m.hp, value: Number(value) } })); }
	async setMemberHpMax(slug, index, max)  { await this._updateMember(slug, index, m => ({ ...m, hp: { ...m.hp, max: Number(max) } })); }

	// Toggle a per-member tag or trait (field = "tags" | "traits").
	async toggleMemberSelection(slug, index, field, value) {
		if (!value || (field !== "tags" && field !== "traits")) return;
		await this._updateMember(slug, index, m => ({
			...m, [field]: Selection.fromStored(m[field], { multi: true }).toggle(value).toRaw(),
		}));
	}

	async _updateMember(slug, index, fn) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const members = _members(item);
		if (index < 0 || index >= members.length) return;
		members[index] = fn(members[index]);
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { members } }]);
	}

	async setArmor(slug, armor) {
		await this._write(slug, f => f.withArmor(armor));
	}

	async setDamage(slug, damage) {
		await this._write(slug, f => f.withDamage(damage));
	}

	async setInstinct(slug, instinct) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const stored = Selection.fromStored(_text(instinct), { multi: false, options: item.system?.instinct?.options ?? [] }).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { instinct: stored } }]);
	}

	async setMoves(slug, moves) {
		await this._write(slug, f => f.withMoves(moves));
	}

	async setCost(slug, cost) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const stored = Selection.fromStored(_text(cost), { multi: false, options: item.system?.cost?.options ?? [] }).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { cost: stored } }]);
	}

	async setNotes(slug, notes) {
		await this._write(slug, f => f.withNotes(notes));
	}

	async setSpecialQuality(slug, specialQuality) {
		await this._write(slug, f => f.withSpecialQuality(specialQuality));
	}

	async setDescription(slug, description) {
		await this._write(slug, f => f.withDescription(description));
	}

	// Animal companion: `system.companion` is atomic (one opaque object), so every writer
	// read-modify-writes the WHOLE object — a partial path would drop sibling keys.

	// Pick a Type: pre-fill the editable hp/armor/damage from its template, set the chosen type,
	// and reset the options pool + pre-checked defaults to that type's. (Pre-fill, not computed —
	// the user can type over hp/armor/damage afterwards.)
	async setCompanionType(slug, typeSlug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const companion = _companion(item);
		const wanted = _text(typeSlug);
		const t = (companion.catalog ?? []).find(x => x.slug === wanted || x.name === wanted);
		if (!t) return;
		companion.type    = { selected: [t.name], options: (companion.catalog ?? []).map(x => x.name), multi: false, allowCustom: true };
		companion.options = { selected: [...(t.defaults ?? [])], options: [...(t.options ?? [])], multi: true, allowCustom: true };
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: {
			companion,
			hp:     { value: t.hp?.value ?? t.hp?.max ?? 0, max: t.hp?.max ?? t.hp?.value ?? 0 },
			armor:  t.armor ?? "",
			damage: t.damage ?? "",
		} }]);
	}

	// Toggle one entry in the companion options pool (the nested multi-select; the generic
	// toggleSelection can't reach `companion.options`).
	async toggleCompanionOption(slug, value) {
		if (!value) return;
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const companion = _companion(item);
		companion.options = Selection.fromStored(companion.options, { multi: true }).toggle(value).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { companion } }]);
	}

	/** The controller for one follower's choice values, or null when the follower is not embedded. */
	controllerFor(slug) {
		const item = _findFollowerItem(this._actor, slug);
		return item ? this._factory.forDocument(item._id, "choiceValues") : null;
	}

	// The card snapshot for every follower the character OWNS. A card-bound follower (the Ring, the Cloak)
	// is owned but stamped showOnTab:false, so it resolves on its arcanum card yet stays off the tab.
	async buildSnapshot() {
		const ownedItems = [...this._actor.items].filter(i => i.type === "follower" && i.system?.owned === true);
		if (!ownedItems.length) return [];
		// Fetch the shared outfit-item catalog once (async) and pass it into each follower's snapshot.
		const repoItems = this._inventoryRepo ? await this._inventoryRepo.getAll() : [];
		return ownedItems.map(item => this._buildFollowerSnapshotFromItem(item, repoItems));
	}

	_buildFollowerSnapshotFromItem(item, repoItems = []) {
		const sys            = item.system;
		const loyaltyCurrent = this._resourceController.getCurrent("followers", sys.slug);
		const inventory      = this._buildFollowerInventory(sys.slug, sys.inventory ?? {}, repoItems);
		return buildFollowerSnapshot(item, { loyaltyCurrent, inventory });
	}

	/**
	 * The character's followers, normalized for the sheet — the single authority, derived entirely from
	 * the actor:
	 *  - `bySlug`: every follower card once — owned instances + definition previews for referenced-but-
	 *    unowned followers (see buildSnapshot). A card resolves its slug against this.
	 *  - `tab`: the OWNED followers whose granting authority placed them on the tab (`showOnTab`). A
	 *    card-bound follower (the Ring) and an un-owned preview are both absent here.
	 */
	async buildFollowersSnapshot() {
		const owned  = await this.buildSnapshot();
		const bySlug = Object.fromEntries(owned.map(f => [f.slug, f]));
		const tab    = [...this._actor.items]
			.filter(i => i.type === "follower" && i.system?.owned === true && i.system?.showOnTab !== false)
			.map(i => i.system?.slug)
			.filter(Boolean);
		return new FollowersSnapshot(bySlug, tab);
	}

	// Build the follower's inventory snapshot — parity with the character (twoCol grids, resources,
	// custom items), via the shared buildOutfitColumn. Regular column only. Load is computed from total
	// checked weight and is informational (highlighted band, never a cap — guide-don't-enforce); a
	// follower is measured against the same MAX_OUTFIT_MARKS ◇ a character is.
	// Returns null when there is nothing to show (no catalog loaded and no custom items).
	//
	// The full `sections` (catalog) is built ONLY when this follower's inventory is open — building it
	// for every follower on every render is what makes tag/item edits sluggish. `ownedSections`
	// (checked items only) drives the compact view.
	_buildFollowerInventory(slug, inv, repoItems) {
		const regular     = repoItems.filter(i => i.inventoryColumn === "regular");
		const customItems = (inv.customItems ?? []).map(c => ({ ...c, inventoryColumn: "regular", ownedId: c.slug }));
		if (!regular.length && !customItems.length) return null;

		const checked    = inv.checked ?? {};
		const resources  = inv.resources ?? {};
		const editing    = this._openInventories.has(slug);
		const resourceFn = oi => oi.resource ? ResourceController.build(oi.resource, resources[oi.slug] ?? 0) : null;

		const owned       = [...regular, ...customItems].filter(i => checked[i.slug]);
		const totalWeight = owned.reduce((s, i) => s + (i.weight ?? 0), 0);
		const band        = loadBand(totalWeight);
		const hasAny      = owned.length > 0;

		return {
			editing,
			hasAny,
			showDetails:   editing || hasAny, // hide load band + list for an empty, collapsed follower
			ownedSections: buildOutfitColumn(regular.filter(i => checked[i.slug]), customItems.filter(i => checked[i.slug]), checked, "regular", resourceFn),
			sections:      editing ? buildOutfitColumn(repoItems, customItems, checked, "regular", resourceFn) : [],
			totalWeight,
			band,
			capacity:     MAX_OUTFIT_MARKS,
			overCapacity: totalWeight > MAX_OUTFIT_MARKS,
			loadLight:     band === "light",
			loadNormal:    band === "normal",
			loadHeavy:     band === "heavy",
		};
	}
}

function _findFollowerItem(actor, slug) {
	return itemOfTypeBySlug(actor, "follower", slug);
}

// Single-line follower fields are stored trimmed, so a stored value round-trips equal to what a
// picker offers — an untrimmed " Loyal" would never match the "Loyal" option and would silently
// become a custom entry.
function _text(value) {
	return typeof value === "string" ? value.trim() : value;
}

// Plain-object clone of a follower's members (Foundry replaces arrays wholesale on update).
function _members(item) {
	return (item.system?.members ?? []).map(m => ({
		name: m.name ?? "",
		hp:   { value: m.hp?.value ?? 0, max: m.hp?.max ?? 0 },
		tags:   Selection.fromStored(m.tags,   { multi: true }).toRaw(),
		traits: Selection.fromStored(m.traits, { multi: true }).toRaw(),
	}));
}

// Deep-ish clone of a follower's atomic `companion` object (Foundry replaces ObjectFields
// wholesale on update, so writers must hand back the full object).
function _companion(item) {
	const c = item.system?.companion ?? {};
	return {
		enabled: !!c.enabled,
		type:    { ...(c.type    ?? { selected: [], options: [], multi: false, allowCustom: true }) },
		options: { ...(c.options ?? { selected: [], options: [], multi: true,  allowCustom: true }) },
		catalog: Array.isArray(c.catalog) ? c.catalog.map(t => ({ ...t })) : [],
	};
}

// The embed payload for a follower the character comes to own — the one shape, whether a card grants it,
// a playbook does, or the player drops it in. `extraSystem` is the granting side's own placement.
function _embeddedFollower(follower, extraSystem = {}) {
	return {
		name: follower.name, type: "follower",
		...(follower.img ? { img: follower.img } : {}),
		system: { ..._followerToSystemFields(follower), owned: true, ...extraSystem },
	};
}

function _followerToSystemFields(follower) {
	return {
		slug:           follower.slug,
		arcanaSlug:     follower.arcanaSlug ?? null,
		kind:           follower.kind ?? "creature",
		tagList:   Tags.creature(follower.tags).toRaw(),
		tagOptions: follower.tagOptions ?? [],
		// New followers start at full HP (pack data stores value 0 as a template default).
		hp:             { value: follower.hp?.max ?? 0, max: follower.hp?.max ?? 0 },
		armor:          follower.armor ?? "",
		damage:         follower.damage ?? "",
		instinct:       Selection.fromStored(follower.instinct).toRaw(),
		moves:          follower.moves ?? "",
		cost:           Selection.fromStored(follower.cost).toRaw(),
		loyalty:        { value: 0, max: follower.loyalty?.max ?? 3 },
		choices:        follower.choices ?? null,
		specialQuality: follower.specialQuality ?? "",
		description:    follower.description ?? "",
		notes:          follower.notes ?? "",
		choiceValues:   {},
		// Group members embed at full HP too (their stored value mirrors max on creation).
		members:        (follower.members ?? []).map(m => ({
			name: m.name ?? "",
			hp:   { value: m.hp?.max ?? 0, max: m.hp?.max ?? 0 },
			tags:   Selection.fromStored(m.tags,   { multi: true }).toRaw(),
			traits: Selection.fromStored(m.traits, { multi: true }).toRaw(),
		})),
		memberSuggestions: follower.memberSuggestions ?? { names: [], tags: [], traits: [] },
		membersNote:    follower.membersNote ?? "",
		companion:      follower.companion ?? blankCompanion(),
	};
}
