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
		this._stats = new CharacterStats(actor);
		this._origin = new CharacterOrigin(actor);
		const outfitItems = new ActorOutfitItems(actor);
		this._resourceController = new ResourceController(actor);
		const factory = new ChoiceGroupFactory(actor);
		this._followers = new CharacterFollowers(actor, repos.followers, this._resourceController, factory);
		factory.register(new FollowerSideEffectHandler(this._followers));
		factory.register(new OutfitItemSideEffectHandler("choice", outfitItems));

		this._background  = new CharacterBackgrounds(actor, factory, this._resourceController);
		this._moves       = new CharacterMoves(repos.moves, actor, new ResourceController(actor, "moveResources"), factory);
		this._playbook    = new CharacterPlaybook(actor, this._background, factory, this._origin);
		this._possessions = new CharacterPossessions(actor, this._moves, outfitItems, repos.possessions);
		this._inventory   = new CharacterInventory(actor, repos.inventory, outfitItems, this._resourceController);
		this._vitals      = new CharacterVitals(actor);
		this._debilities  = new CharacterDebilities(actor);
		this._arcana      = new CharacterArcana(actor, repos.arcana, this._stats, outfitItems, this._followers, factory);
		this._inserts     = new CharacterInserts(actor, factory, this._moves);
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

	get background() {
		return this._background;
	}

	get origin() {
		return this._origin;
	}

	async playbook() {
		return this._playbook.getData();
	}

	async buildSnapshot() {
		await this._moves.initBasicMoves();
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

	get ownedArcanaSlugs() {
		return this._arcana.ownedSlugs;
	}

	async onDropItems(items) {
		if (items.some(i => i.type === "playbook")) {
			const existing = [...this._actor.items].find(i => i.type === "playbook");
			if (existing) await this._actor.deleteEmbeddedDocuments("Item", [existing._id]);
		}
		const followers = items.filter(i => i.type === "npc");
		const moves = items.filter(i => i.type === "move");
		const others = items.filter(i => i.type !== "move" && i.type !== "npc");
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

	async setArcanumBackChoiceValue(arcanumSlug, optionSlug, count) {
		await this._arcana.setBackChoiceValue(arcanumSlug, optionSlug, count);
	}

	async setBackgroundResource(slug, count) {
		await this._background.setResource(slug, count);
	}

	async setChoiceCount(context, group, option, count) {
		switch (context) {
			case "arcana-unlock":
				return await this._arcana.setUnlockCount(group, option, count);
			case "playbook-choice":
			case "lore":
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

	async addCustomFollower() {
		await this._followers.addCustomFollower();
	}

	async setHP(hp) {
		await this._vitals.setHP(hp);
	}

	async setXP(xp) {
		await this._vitals.setXP(xp);
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

	async setFollowerHp(slug, hp) {
		await this._followers.setHp(slug, hp);
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

	async setFollowerNote(slug, note) {
		await this._followers.setNote(slug, note);
	}

	async setFollowerArmor(slug, armor) {
		await this._followers.setArmor(slug, armor);
	}

	async setFollowerDamage(slug, damage) {
		await this._followers.setDamage(slug, damage);
	}
}
