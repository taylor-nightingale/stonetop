import {CharacterSnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";
import {CharacterMoves} from "./CharacterMoves.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterOrigin} from "./CharacterOrigin.js";
import {CharacterPossessions} from "./CharacterPossessions.js";
import {CharacterInventory} from "./CharacterInventory.js";
import {CharacterArcana} from "./CharacterArcana.js";
import {CharacterInserts} from "./CharacterInserts.js";
import {CharacterFollowers} from "./CharacterFollowers.js";
import {ResourceController} from "./ResourceController.js";
import {CharacterStats} from "./CharacterStats.js";
import {CharacterVitals} from "./CharacterVitals.js";
import {CharacterDebilities} from "./CharacterDebilities.js";
import {CharacterPlaybook} from "./CharacterPlaybook.js";
import {FoundryRepositoryFactory} from "./repositories/FoundryRepositoryFactory.js";
import {ActorOutfitItems} from "./ActorOutfitItems.js";
import {ChoiceGroupFactory} from "./ChoiceGroupFactory.js";
import {FollowerSideEffectHandler, OutfitItemSideEffectHandler} from "./SideEffectHandler.js";

export class StonetopCharacter {
	constructor(actor, repos) {
		this._actor = actor;
		this._playbookRepo = repos.playbooks ?? null;
		this._stats = new CharacterStats(actor);
		this._origin = new CharacterOrigin(actor);
		const outfitItems = new ActorOutfitItems(actor);
		this._resourceController = new ResourceController(actor);
		const factory = new ChoiceGroupFactory(actor);
		this._followers = new CharacterFollowers(actor, repos.followers, this._resourceController, factory, repos.inventory);
		factory.register(new FollowerSideEffectHandler(this._followers));
		factory.register(new OutfitItemSideEffectHandler("choice", outfitItems));

		this._background  = new CharacterBackgrounds(actor, factory, this._resourceController);
		this._moves       = new CharacterMoves(repos.moves, actor, new ResourceController(actor, "moveResources"), factory);
		this._playbook    = new CharacterPlaybook(actor, this._background, factory, this._origin);
		this._possessions = new CharacterPossessions(actor, this._moves, outfitItems, repos.possessions, factory);
		this._inventory   = new CharacterInventory(actor, repos.inventory, outfitItems, this._resourceController, repos.steading);
		this._vitals      = new CharacterVitals(actor);
		this._debilities  = new CharacterDebilities(actor);
		this._arcana      = new CharacterArcana(actor, repos.arcana, this._stats, outfitItems, this._followers, factory, this._moves);
		this._inserts     = new CharacterInserts(actor, factory, this._moves, repos.inserts);
		this._playbook.setVitals(this._vitals);
		this._playbook.setMoves(this._moves);
		this._moves.setVitals(this._vitals);
	}

	static create(actor) {
		return new StonetopCharacter(actor, new FoundryRepositoryFactory());
	}

	get type() {
		return this._actor.type;
	}

	get bio()   { return this._actor.system?.description ?? ""; }
	get notes() { return this._actor.system?.notes       ?? ""; }

	async setBio(value)   { await this._actor.update({ "system.description": value }); }
	async setNotes(value) { await this._actor.update({ "system.notes": value }); }

	get background() {
		return this._background;
	}

	get origin() {
		return this._origin;
	}

	async playbook() {
		return this._playbook.getData();
	}

	// Pre-create, before the document persists (updateSource-only territory). Characters have no
	// pre-create defaults; the hook dispatches here uniformly.
	onPreCreate(_data) {}

	// Post-create initialization, once, on the creating client (CreateActor hook → typedActor
	// dispatch). Seeds the reference moves (basic/special/follower) as owned items the GM controls
	// — never re-run on render.
	async onCreate() {
		await this._moves.initBasicMoves();
	}

	async buildSnapshot() {
		const level = this._vitals.level;
		const {checked} = this._inventory;
		const actor = this._actor;
		const followers = await this._followers.buildSnapshot();
		const [arcana, outfit, inserts, playbook, vitals, moves, possessions] = await Promise.all([
			this._arcana.buildSnapshot(checked, this._resourceController),
			this._inventory.buildSnapshot(level),
			this._inserts.buildSnapshot(),
			this._playbook.buildPlaybookSnapshot(),
			this._vitals.buildVitalsSnapshot(),
			this._moves.buildSnapshot(),
			this._possessions.buildSnapshot(level),
		]);
		return new CharacterSnapshotBuilder()
			.withName(actor.name)
			.withPlaybook(playbook)
			.withDebilities(this._debilities.buildDebilitiesSnapshot())
			.withStats(this._stats.buildStatsSnapshot())
			.withVitals(vitals)
			.withMoves(moves)
			.withOutfit(outfit)
			.withPossessions(possessions)
			.withArcana(arcana)
			.withInserts(inserts)
			.withFollowers(followers)
			.withRollMode(this.rollMode)
			.withBio(this.bio)
			.withNotes(this.notes)
			.build();
	}

	async removeInsert(itemId) {
		await this._inserts.removeInsert(itemId);
	}

	async setInventoryItemChecked(slug, isChecked) {
		await this._inventory.setItemChecked(slug, isChecked);
		const armor = await this._inventory.getArmor();
		await this._vitals.setArmor(armor);
	}

	async setInventoryResource(slug, count) {
		await this._inventory.setResource(slug, count);
	}

	async setInventoryLoadLevel(level) {
		await this._inventory.setLoadLevel(level);
	}

	async setInventoryRegularPool(count) {
		await this._inventory.setRegularPool(count);
	}

	async setInventorySmallPool(count) {
		await this._inventory.setSmallPool(count);
	}

	async setInventoryOtherItems(value) {
		await this._inventory.setOtherItems(value);
	}

	async setMoveResourceCurrent(moveSlug, current) {
		await this._moves.setMoveResourceCurrent(moveSlug, current);
	}

	async setMoveResourceText(moveSlug, value) {
		await this._moves.setMoveResourceText(moveSlug, value);
	}

	async addCustomInventoryItem(name, weight) {
		await this._inventory.addCustomItem(name, weight);
	}

	async addCustomSmallItem(name) {
		await this._inventory.addCustomSmallItem(name);
	}

	async removeCustomInventoryItem(itemId) {
		await this._inventory.removeCustomItem(itemId);
	}

	async selectPossession(slug) {
		await this._possessions.select(slug);
	}

	async deselectPossession(slug) {
		await this._possessions.deselect(slug);
	}

	async deletePossession(slug) {
		await this._possessions.deletePossession(slug);
	}

	async setPossessionChoiceValue(possessionSlug, optionSlug, value) {
		await this._possessions.setChoiceValue(possessionSlug, optionSlug, value);
	}

	async setPossessionUses(slug, count) {
		await this._possessions.setUses(slug, count);
	}

	async selectSubChoice(possessionSlug, choiceSlug) {
		await this._possessions.addSubChoice(possessionSlug, choiceSlug);
	}

	async deselectSubChoice(possessionSlug, choiceSlug) {
		await this._possessions.removeSubChoice(possessionSlug, choiceSlug);
	}

	async selectSubChoiceExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		await this._possessions.selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs);
	}

	async setSubChoiceUses(possessionSlug, choiceSlug, count) {
		await this._possessions.setChoiceUses(possessionSlug, choiceSlug, count);
	}

	async selectBackground(slug) {
		await this._playbook.selectBackground(slug);
	}

	async selectCustomInstinct(text) {
		await this._playbook.selectCustomInstinct(text);
	}

	get ownedArcanaSlugs() {
		return this._arcana.ownedSlugs;
	}

	async onDropItems(items) {
		if (items.some(i => i.type === "playbook")) {
			const existing = [...this._actor.items].find(i => i.type === "playbook");
			if (existing) await this._actor.deleteEmbeddedDocuments("Item", [existing._id]);
		}
		// "npc" tolerated alongside "follower" for a dropped pre-migration follower item.
		const followers = items.filter(i => i.type === "follower" || i.type === "npc");
		const moves = items.filter(i => i.type === "move");
		const others = items.filter(i => i.type !== "move" && i.type !== "follower" && i.type !== "npc");
		let anyAdded = false;
		for (const item of followers) {
			const slug = item.system?.slug;
			if (slug) {
				await this._followers.addFollower(slug);
				anyAdded = true;
			}
		}
		for (const item of moves) {
			if (await this.onDropMove(item)) anyAdded = true;
		}
		return { anyAdded, others };
	}

	// V2 drop-pipeline entry: route the dropped item data (playbooks replace, followers/moves are
	// absorbed, already-owned arcana are skipped) and embed whatever Foundry should own natively.
	// Returns the embedded item data (empty when everything was absorbed).
	async applyDroppedItems(items) {
		const ownedArcanaSlugs = this.ownedArcanaSlugs;
		const newArcana = items.filter(
			i => i.type === "arcanum" && !ownedArcanaSlugs.has(i.system?.slug),
		);
		const nonArcana = items.filter(i => i.type !== "arcanum");
		const { others } = await this.onDropItems(nonArcana);
		const toEmbed = [...newArcana, ...others];
		if (toEmbed.length) await this._actor.createEmbeddedDocuments("Item", toEmbed);
		return toEmbed;
	}

	// The playbook dropdown: look the item up by slug (pack first, then world) and run it through
	// the same path a dropped playbook item takes.
	async applyPlaybookBySlug(slug) {
		if (!slug) return;
		const data = await this._playbookRepo.findItemDataBySlug(slug);
		if (data) await this.applyDroppedItems([data]);
	}

	async incrementMove(categoryKey, moveName) {
		await this._moves.incrementMove(categoryKey, moveName);
	}

	async decrementMove(categoryKey, moveName) {
		await this._moves.decrementMove(categoryKey, moveName);
	}

	async deleteMove(moveName) {
		await this._moves.deleteMove(moveName);
	}

	async _onCreateDescendantDocuments(documents) {
		const playbookItem = documents.find(d => d.type === "playbook");
		if (playbookItem) {
			const playbookData = playbookItem.asPlaybook();
			await this._playbook.selectPlaybook(playbookData);
			await this._followers.syncPlaybookFollowers(playbookData.slug, playbookData.followers);
			await this._inserts.syncPlaybookInserts(playbookData.slug, playbookData.inserts);
			await this._possessions.addPossessionsFromPlaybook(
				playbookData.specialPossessions, playbookData.slug,
			);
		}

		const insertItem = documents.find(d => d.type === "insert");
		if (insertItem) await this._inserts.onInsertDropped(insertItem);

		for (const item of documents.filter(d => d.type === "arcanum")) {
			await this._arcana.onArcanumCreated(item);
		}
	}

	async _onDeleteDescendantDocuments(documents) {
		const playbookItem = documents.find(d => d.type === "playbook");
		if (playbookItem) {
			await this._possessions.removePossessionsFromPlaybook(
				playbookItem.system?.slug ?? null,
			);
		}

		const insertItem = documents.find(d => d.type === "insert");
		if (insertItem) await this._inserts.onInsertRemoved(insertItem.system?.slug ?? null);
	}

	get rollMode() {
		return this._actor.getFlag("stonetop", "rollMode") ?? "normal";
	}

	async setRollMode(mode) {
		await this._actor.setFlag("stonetop", "rollMode", mode);
	}

	getRollableStats() {
		return this._stats.getRollableStats();
	}

	resolveBonus(stat) {
		return this._stats.resolveBonus(stat);
	}

	applyRollMode(stat, rollMode) {
		return this._debilities.applyRollMode(stat, rollMode);
	}

	async onDropMove(itemData) {
		return this._moves.onDropMove(itemData);
	}

	async removeArcanum(slug) {
		await this._arcana.removeArcanum(slug);
	}

	async flipArcanum(slug) {
		await this._arcana.flipArcanum(slug);
	}

	async unflipArcanum(slug) {
		await this._arcana.unflipArcanum(slug);
	}

	// Generic arcana choice-group writes: the sheet routes every arcanum choice row here off the
	// `.stonetop-arcanum-card` wrapper (like inserts route off `data-insert-item-id`), passing the
	// group's own slug — no per-group context strings.
	async setArcanumChoiceCount(arcanumSlug, groupSlug, optionSlug, count) {
		await this._arcana.setChoiceCount(arcanumSlug, groupSlug, optionSlug, count);
	}

	async selectArcanumChoice(arcanumSlug, groupSlug, optionSlug, siblingsCsv) {
		await this._arcana.selectChoice(arcanumSlug, groupSlug, optionSlug, siblingsCsv);
	}

	async setArcanumChoiceText(arcanumSlug, groupSlug, optionSlug, text) {
		await this._arcana.setChoiceText(arcanumSlug, groupSlug, optionSlug, text);
	}

	async setArcanumBlank(arcanumSlug, key, text) {
		await this._arcana.setBlankValue(arcanumSlug, key, text);
	}

	getArcanumBlanks(arcanumSlug) {
		return this._arcana.getBlanks(arcanumSlug);
	}

	async setBackgroundResource(slug, count) {
		await this._background.setResource(slug, count);
	}

	async setChoiceCount(context, group, option, count) {
		switch (context) {
			case "playbook-choice":
			case "lore":
			case "intro-npc":
			case "intro-pc":
				return await this._playbook.setChoiceCount(group, option, count);
			case "background":
				return await this._background.setChoiceValue(group, option, count);
			case "move":
				return await this._moves.setMoveChoiceCount(group, option, count);
		}
	}

	async setChoicePick(context, group, option, siblingsCsv, checked = true) {
		switch (context) {
			case "playbook-choice":
			case "lore":
			case "intro-npc":
			case "intro-pc":
			case "instinct":
			case "appearance":
				return await this._playbook.selectChoice(group, option, siblingsCsv);
			case "follower":
				return await this._followers.setChoiceValue(group, "choices", option, siblingsCsv);
			case "background":
				return this._background.setChoiceValue(group, option, checked ? 1 : 0);
		}
	}

	async setChoiceText(context, group, option, value) {
		switch (context) {
			case "playbook-choice":
			case "lore":
			case "intro-npc":
			case "intro-pc":
				return await this._playbook.setChoiceText(group, option, value);
			case "follower":
				return await this._followers.setChoiceText(group, option, value);
			case "move":
				return await this._moves.setMoveChoiceText(group, option, value);
		}
	}

	async setInsertChoiceCount(itemId, groupSlug, optionSlug, count) {
		await this._inserts.setCount(itemId, groupSlug, optionSlug, count);
	}

	async setInsertChoicePick(itemId, groupSlug, optionSlug, siblingsCsv) {
		await this._inserts.selectOption(itemId, groupSlug, optionSlug, siblingsCsv);
	}

	async setInsertChoiceText(itemId, groupSlug, optionSlug, text) {
		await this._inserts.setText(itemId, groupSlug, optionSlug, text);
	}

	async setArcanumResource(slug, count) {
		await this._inventory.setResource(slug, count);
	}

	// --- ChoiceTarget routing -----------------------------------------------------------------
	// The sheet builds a ChoiceTarget from the row's DOM containers; the possession/insert/
	// arcanum/plain dispatch lives here, not in the handlers.

	// Track checkboxes: checking box `index` fills the track through index+1; unchecking empties
	// back to index.
	async setChoiceTrackFor(target, index, checked) {
		const count = checked ? Number(index) + 1 : Number(index);
		await this.setChoiceCountFor(target, count);
	}

	async setChoiceCountFor(target, count) {
		if (target.possessionSlug) return this.setPossessionChoiceValue(target.possessionSlug, target.option, count);
		if (target.insertItemId)   return this.setInsertChoiceCount(target.insertItemId, target.group, target.option, count);
		if (target.arcanumSlug)    return this.setArcanumChoiceCount(target.arcanumSlug, target.group, target.option, count);
		return this.setChoiceCount(target.context, target.group, target.option, count);
	}

	async setChoicePickFor(target, checked = true) {
		if (!target.context) return;
		if (target.insertItemId) return this.setInsertChoicePick(target.insertItemId, target.group, target.option, target.siblingsCsv);
		if (target.arcanumSlug)  return this.selectArcanumChoice(target.arcanumSlug, target.group, target.option, target.siblingsCsv);
		return this.setChoicePick(target.context, target.group, target.option, target.siblingsCsv, checked);
	}

	async setChoiceTextFor(target, text) {
		if (target.possessionSlug) return this.setPossessionChoiceValue(target.possessionSlug, target.option, text);
		if (!target.context) return;
		if (target.insertItemId) return this.setInsertChoiceText(target.insertItemId, target.group, target.option, text);
		if (target.arcanumSlug)  return this.setArcanumChoiceText(target.arcanumSlug, target.group, target.option, text);
		return this.setChoiceText(target.context, target.group, target.option, text);
	}

	// --- Pip and check toggles ----------------------------------------------------------------
	// Resource pips: clicking the checked pip at `index` empties back to it, clicking an unchecked
	// one fills through it. Sheets pass the raw dataset index and the pip's current checked state.

	#pipCount(index, isChecked) {
		return isChecked ? Number(index) : Number(index) + 1;
	}

	async toggleMoveResourcePip(moveSlug, index, isChecked) {
		await this.setMoveResourceCurrent(moveSlug, this.#pipCount(index, isChecked));
	}

	async toggleArcanumResourcePip(slug, index, isChecked) {
		await this.setArcanumResource(slug, this.#pipCount(index, isChecked));
	}

	async toggleBackgroundResourcePip(slug, index, isChecked) {
		await this.setBackgroundResource(slug, this.#pipCount(index, isChecked));
	}

	async toggleFollowerLoyaltyPip(slug, index, isChecked) {
		await this.setFollowerLoyalty(slug, this.#pipCount(index, isChecked));
	}

	async togglePossessionUsePip(possessionSlug, choiceSlug, index, isChecked) {
		const count = this.#pipCount(index, isChecked);
		if (choiceSlug) return this.setSubChoiceUses(possessionSlug, choiceSlug, count);
		return this.setPossessionUses(possessionSlug, count);
	}

	// Pool checkboxes are tracks (see setChoiceTrackFor): checked fills through index+1.
	async toggleInventoryRegularPool(index, checked) {
		await this.setInventoryRegularPool(checked ? Number(index) + 1 : Number(index));
	}

	async toggleInventorySmallPool(index, checked) {
		await this.setInventorySmallPool(checked ? Number(index) + 1 : Number(index));
	}

	async setMoveChecked(categoryKey, moveSlug, checked) {
		if (checked) return this.incrementMove(categoryKey, moveSlug);
		return this.decrementMove(categoryKey, moveSlug);
	}

	async setPossessionSelected(slug, selected) {
		if (selected) return this.selectPossession(slug);
		return this.deselectPossession(slug);
	}

	async setSubChoiceSelected(possessionSlug, choiceSlug, selected) {
		if (selected) return this.selectSubChoice(possessionSlug, choiceSlug);
		return this.deselectSubChoice(possessionSlug, choiceSlug);
	}

	async toggleArcanumFlip(slug, currentlyFlipped) {
		if (currentlyFlipped) return this.unflipArcanum(slug);
		return this.flipArcanum(slug);
	}

	// --- Shared-inventory routing ------------------------------------------------------------
	// A shared outfit item lives in the character's inventory tab OR inside a follower card;
	// the sheet reads the follower slug off the wrapper (null = the character's own inventory)
	// and these route it.

	async setInventoryItemCheckedFor(followerSlug, itemSlug, checked) {
		if (followerSlug) return this.setFollowerInvItemChecked(followerSlug, itemSlug, checked);
		return this.setInventoryItemChecked(itemSlug, checked);
	}

	async toggleInventoryResourcePipFor(followerSlug, itemSlug, index, isChecked) {
		const count = this.#pipCount(index, isChecked);
		if (followerSlug) return this.setFollowerInvResource(followerSlug, itemSlug, count);
		return this.setInventoryResource(itemSlug, count);
	}

	async addCustomInventoryItemFor(followerSlug, name, weight, isRegular) {
		if (followerSlug) return this.addFollowerInvCustomItem(followerSlug, name, weight);
		if (isRegular)    return this.addCustomInventoryItem(name, weight);
		return this.addCustomSmallItem(name);
	}

	async removeCustomInventoryItemFor(followerSlug, itemId) {
		if (followerSlug) return this.removeFollowerInvCustomItem(followerSlug, itemId);
		return this.removeCustomInventoryItem(itemId);
	}

	async addCustomFollower() {
		await this._followers.addCustomFollower();
	}

	async addFollowerFromActor(actor) {
		await this._followers.addFromNpcActor(actor);
	}

	async setHP(hp) {
		await this._vitals.setHP(hp);
	}

	async setXP(xp) {
		await this._vitals.setXP(xp);
	}

	async markXp() {
		return this._vitals.markXp();
	}

	async unmarkXp() {
		return this._vitals.unmarkXp();
	}

	async setLevel(level) {
		await this._vitals.setLevel(level);
	}

	async setMaxHP(max) {
		await this._vitals.setMaxHP(max);
	}

	async setArmor(armor) {
		await this._vitals.setArmor(armor);
	}

	async setDamage(die) {
		await this._vitals.setDamage(die);
	}

	async setDebility(slug, value) {
		await this._debilities.setDebility(slug, value);
	}

	async removeFollower(slug) {
		await this._followers.removeFollower(slug);
	}

	// `hpMax` is the follower card's max box as the user currently sees it (possibly uncommitted,
	// so the sheet reads it off the DOM); HP clamps into [0, hpMax] when it parses to a number.
	async setFollowerHp(slug, hp, hpMax = null) {
		let value = Math.max(0, Number(hp));
		// A blank or absent max means "no upper clamp" (Number("") would read as 0).
		const max = hpMax === null || hpMax === "" ? NaN : Number(hpMax);
		if (Number.isFinite(max)) value = Math.min(value, max);
		await this._followers.setHp(slug, value);
	}

	async setFollowerLoyalty(slug, loyalty) {
		await this._followers.setLoyalty(slug, loyalty);
	}

	async setFollowerHpMax(slug, hpMax) {
		await this._followers.setHpMax(slug, hpMax);
	}

	async setFollowerName(slug, name) {
		await this._followers.setName(slug, name);
	}

	async toggleFollowerSelection(slug, field, value) {
		await this._followers.toggleSelection(slug, field, value);
	}

	// A tag chip / tag-add box lives on a follower card, one of its group members (memberIndex
	// set), or the companion options (which nest inside the atomic `companion` object rather than
	// a top-level field) — the sheet reads the wrap's dataset, this owns the routing.
	async toggleFollowerTag(slug, field, memberIndex, value) {
		if (memberIndex !== null && memberIndex !== undefined) {
			return this.toggleFollowerMemberSelection(slug, Number(memberIndex), field, value);
		}
		if (field === "companionOptions") return this.toggleFollowerCompanionOption(slug, value);
		return this.toggleFollowerSelection(slug, field, value);
	}

	async setFollowerArmor(slug, armor) {
		await this._followers.setArmor(slug, armor);
	}

	async setFollowerInstinct(slug, instinct) {
		await this._followers.setInstinct(slug, instinct);
	}

	async setFollowerInvItemChecked(followerSlug, itemSlug, checked) {
		await this._followers.setInvItemChecked(followerSlug, itemSlug, checked);
	}

	async addFollowerInvCustomItem(followerSlug, name, weight) {
		await this._followers.addInvCustomItem(followerSlug, name, weight);
	}

	async removeFollowerInvCustomItem(followerSlug, itemSlug) {
		await this._followers.removeInvCustomItem(followerSlug, itemSlug);
	}

	async setFollowerInvResource(followerSlug, itemSlug, count) {
		await this._followers.setInvResource(followerSlug, itemSlug, count);
	}

	// Transient: which followers have their inventory catalog expanded (the sheet owns this state and
	// passes it in before each snapshot build).
	setOpenFollowerInventories(slugs) {
		this._followers.setOpenInventories(slugs);
	}

	async setFollowerCompanionType(slug, type) {
		await this._followers.setCompanionType(slug, type);
	}

	async toggleFollowerCompanionOption(slug, value) {
		await this._followers.toggleCompanionOption(slug, value);
	}

	async setFollowerMoves(slug, moves) {
		await this._followers.setMoves(slug, moves);
	}

	async setFollowerCost(slug, cost) {
		await this._followers.setCost(slug, cost);
	}

	async setFollowerNotes(slug, notes) {
		await this._followers.setNotes(slug, notes);
	}

	async setFollowerSpecialQuality(slug, specialQuality) {
		await this._followers.setSpecialQuality(slug, specialQuality);
	}

	async setFollowerDescription(slug, description) {
		await this._followers.setDescription(slug, description);
	}

	async setFollowerDamage(slug, damage) {
		await this._followers.setDamage(slug, damage);
	}

	// Group members
	async addFollowerMember(slug)                 { await this._followers.addMember(slug); }
	async removeFollowerMember(slug, index)       { await this._followers.removeMember(slug, index); }
	async setFollowerMemberName(slug, index, name)  { await this._followers.setMemberName(slug, index, name); }
	async setFollowerMemberHp(slug, index, value)   { await this._followers.setMemberHp(slug, index, value); }
	async setFollowerMemberHpMax(slug, index, max)  { await this._followers.setMemberHpMax(slug, index, max); }
	async toggleFollowerMemberSelection(slug, index, field, value) { await this._followers.toggleMemberSelection(slug, index, field, value); }
}
