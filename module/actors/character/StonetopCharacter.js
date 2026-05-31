import {CharacterSnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";
import {CharacterMoves} from "./CharacterMoves.js";
import {StonetopFlags} from "./StonetopFlags.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterInstincts} from "./CharacterInstincts.js";
import {CharacterAppearance} from "./CharacterAppearance.js";
import {CharacterOrigin} from "./CharacterOrigin.js";
import {CharacterPossessions} from "./CharacterPossessions.js";
import {CharacterInventory} from "./CharacterInventory.js";
import {CharacterArcana} from "./CharacterArcana.js";
import {CharacterLore} from "./CharacterLore.js";
import {CharacterPostDeath} from "./CharacterPostDeath.js";
import {CharacterFollowers} from "./CharacterFollowers.js";
import {CharacterStats} from "./CharacterStats.js";
import {CharacterVitals} from "./CharacterVitals.js";
import {CharacterPlaybook} from "./CharacterPlaybook.js";
import {FoundryRepositoryFactory} from "./repositories/FoundryRepositoryFactory.js";
import {ActorOutfitItems} from "./ActorOutfitItems.js";

export class StonetopCharacter {
	constructor(actor, repos) {
		this._actor = actor;
		this._stats = new CharacterStats(actor);
		this._background = new CharacterBackgrounds(new StonetopFlags(actor, "background"));
		this._instinct = new CharacterInstincts(new StonetopFlags(actor, "instinct"));
		this._appearance = new CharacterAppearance(new StonetopFlags(actor, "appearance"));
		this._origin = new CharacterOrigin(new StonetopFlags(actor, "origin"), actor);
		this._lore = new CharacterLore(new StonetopFlags(actor, "lore"));

		this._playbook = new CharacterPlaybook(actor, repos.playbook,
			this._background, this._instinct, this._appearance, this._origin, this._lore);
		this._moves = new CharacterMoves(repos.moves, new StonetopFlags(actor, "moves"), actor);
		const outfitItems = new ActorOutfitItems(actor);
		this._possessions = new CharacterPossessions(new StonetopFlags(actor, "possessions"), this._moves, outfitItems, this._playbook);
		this._inventory = new CharacterInventory(new StonetopFlags(actor, "inventory"), repos.inventory, this._possessions, outfitItems);
		this._vitals = new CharacterVitals(actor, this._inventory);
		this._followers = new CharacterFollowers(new StonetopFlags(actor, "followers"), repos.followers);
		this._arcana = new CharacterArcana(new StonetopFlags(actor, "arcana"), repos.arcana, this._stats, outfitItems, this._followers);
		this._postDeath = new CharacterPostDeath(
			new StonetopFlags(actor, "postDeathInsert"),
			new CharacterInstincts(new StonetopFlags(actor, "postDeathInstinct")),
			new CharacterLore(new StonetopFlags(actor, "postDeathLore")),
			repos.postDeathInsert,
			this._moves,
		);
		this._playbook.setVitals(this._vitals);
		this._playbook.setMoves(this._moves);
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

	get instinct() {
		return this._instinct;
	}

	get appearance() {
		return this._appearance;
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
		const { checked, resources } = this._inventory;
		const actor = this._actor;
		const followers = await this._followers.buildSnapshot();
		const [arcana, inventory, postDeath, playbook, vitals] = await Promise.all([
			this._arcana.buildSnapshot(checked, resources),
			this._inventory.buildSnapshot(level),
			this._postDeath.buildSnapshot(),
			this._playbook.buildPlaybookSnapshot(),
			this._vitals.buildVitalsSnapshot(),
		]);
		return new CharacterSnapshotBuilder()
			.withName(actor.name)
			.withPlaybook(playbook)
			.withDebilities(this._stats.buildDebilitiesSnapshot())
			.withStats(this._stats.buildStatsSnapshot())
			.withVitals(vitals)
			.withMoves(this._moves.buildSnapshot())
			.withInventory(inventory)
			.withArcana(arcana)
			.withPostDeathInsert(postDeath)
			.withFollowers(followers)
			.withRollMode(actor.getFlag("pbta", "rollMode") ?? "normal")
			.build();
	}

	async setPostDeathInsert(slug) {
		await this._postDeath.setInsert(slug);
	}

	async setPostDeathInstinct(slug, siblingSlugsCsv) {
		await this._postDeath.instinct.selectOption(slug, siblingSlugsCsv);
	}

	async setPostDeathLoreCount(loreSlug, optSlug, n) {
		await this._postDeath.lore.set(loreSlug, optSlug, n);
	}

	async setPostDeathLoreText(loreSlug, optSlug, value) {
		await this._postDeath.lore.set(loreSlug, optSlug, value);
	}

	async setInventoryItemChecked(slug, isChecked) {
		await this._inventory.setItemChecked(slug, isChecked);
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

	async setMoveResourceCurrent(categoryKey, moveName, current) {
		await this._moves.setMoveResourceCurrent(categoryKey, moveName, current);
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
		const sp = (await this._playbook.getData())?.specialPossessions ?? null;
		await this._possessions.select(slug, sp);
	}

	async deselectPossession(slug) {
		await this._possessions.deselect(slug);
	}

	async setPossessionUses(slug, count) {
		await this._possessions.setUses(slug, count);
	}

	async selectSubChoice(possessionSlug, choiceSlug) {
		const sp = (await this._playbook.getData())?.specialPossessions ?? null;
		await this._possessions.addSubChoice(possessionSlug, choiceSlug, sp);
	}

	async deselectSubChoice(possessionSlug, choiceSlug) {
		const sp = (await this._playbook.getData())?.specialPossessions ?? null;
		await this._possessions.removeSubChoice(possessionSlug, choiceSlug, sp);
	}

	async selectSubChoiceExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		const sp = (await this._playbook.getData())?.specialPossessions ?? null;
		await this._possessions.selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs, sp);
	}

	async setSubChoiceUses(possessionSlug, choiceSlug, count) {
		await this._possessions.setChoiceUses(possessionSlug, choiceSlug, count);
	}

	async selectBackground(slug) {
		await this._playbook.selectBackground(slug);
	}

	async onDropItems(items) {
		const isArcanum = i => i.type === "equipment" && i.system?.equipmentType === "arcanum";
		const arcana    = items.filter(isArcanum);
		const followers = items.filter(i => i.type === "equipment" && i.system?.equipmentType === "follower");
		const moves     = items.filter(i => i.type === "move");
		const others    = items.filter(i => !isArcanum(i) && i.type !== "move" && i.system?.equipmentType !== "follower");
		let anyAdded = false;
		for (const item of arcana) {
			const slug = item.flags?.stonetop?.slug;
			if (slug) { await this.addArcanum(slug); anyAdded = true; }
		}
		for (const item of followers) {
			const slug = item.flags?.stonetop?.slug;
			if (slug) { await this._followers.addFollower(slug); anyAdded = true; }
		}
		for (const item of moves) {
			if (await this.onDropMove(item)) anyAdded = true;
		}
		return {anyAdded, others};
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
		const stonetopItem = documents.find(d => d.type === "playbook");
		if (!stonetopItem) return;
		const playbookData = stonetopItem.asPlaybook();
		await this._playbook.selectPlaybook(playbookData);
		const sp = playbookData.specialPossessions;
		for (const slug of sp?.preselected ?? []) {
			await this._possessions.syncPossessionItems(slug, sp);
		}
	}

	async onRoll(event) {
		return this._stats.onRoll(event);
	}

	async onDropMove(itemData) {
		return this._moves.onDropMove(itemData);
	}

	async addArcanum(slug) {
		await this._arcana.addArcanum(slug);
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

	async setArcanumUnlockCount(arcanumSlug, optionSlug, count) {
		await this._arcana.setUnlockCount(arcanumSlug, optionSlug, count);
	}

	async setArcanumBackChoiceValue(arcanumSlug, optionSlug, count) {
		await this._arcana.setBackChoiceValue(arcanumSlug, optionSlug, count);
	}

	async setChoiceCount(context, group, option, count) {
		switch (context) {
			case "arcana-unlock": return this.setArcanumUnlockCount(group, option, count);
			case "lore":          return this.setLoreOptionCount(group, option, count);
			case "pdi-lore":      return this.setPostDeathLoreCount(group, option, count);
		}
	}

	async setChoicePick(context, group, option, siblingsCsv) {
		switch (context) {
			case "instinct":     return this.instinct.selectOption(option, siblingsCsv);
			case "pdi-instinct": return this.setPostDeathInstinct(option, siblingsCsv);
			case "appearance":   return this.appearance.selectOption(option, siblingsCsv);
			case "follower":     return this.setFollowerChoiceValue(group, "choices", option, siblingsCsv);
		}
	}

	async setChoiceText(context, group, option, value) {
		switch (context) {
			case "lore":     return this.setLoreOptionText(group, option, value);
			case "pdi-lore": return this.setPostDeathLoreText(group, option, value);
			case "follower": return this.setFollowerChoiceText(group, option, value);
		}
	}

	async setArcanumResource(slug, count) {
		await this._inventory.setResource(slug, count);
	}

	async setLoreOptionCount(loreSlug, optionSlug, count) {
		await this._lore.set(loreSlug, optionSlug, count);
	}

	async setLoreOptionText(loreSlug, optionSlug, value) {
		await this._lore.set(loreSlug, optionSlug, value);
	}

	async addCustomFollower() {
		await this._followers.addCustomFollower();
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

	async setFollowerChoiceValue(slug, groupSlug, choiceSlug, siblingSlugsCsv) {
		await this._followers.setChoiceValue(slug, groupSlug, choiceSlug, siblingSlugsCsv);
	}

	async setFollowerChoiceText(followerSlug, optionSlug, text) {
		await this._followers.setChoiceText(followerSlug, optionSlug, text);
	}

	async setFollowerArmor(slug, armor) {
		await this._followers.setArmor(slug, armor);
	}

	async setFollowerDamage(slug, damage) {
		await this._followers.setDamage(slug, damage);
	}
}
