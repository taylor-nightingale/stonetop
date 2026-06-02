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
import {ChoiceGroupController} from "./ChoiceGroupController.js";
import {ResourceController} from "./ResourceController.js";
import {CharacterStats} from "./CharacterStats.js";
import {CharacterVitals} from "./CharacterVitals.js";
import {CharacterDebilities} from "./CharacterDebilities.js";
import {CharacterRolling} from "./CharacterRolling.js";
import {CharacterPlaybook} from "./CharacterPlaybook.js";
import {FoundryRepositoryFactory} from "./repositories/FoundryRepositoryFactory.js";
import {ActorOutfitItems} from "./ActorOutfitItems.js";

export class StonetopCharacter {
	constructor(actor, repos) {
		this._actor = actor;
		this._stats = new CharacterStats(actor);
		this._origin = new CharacterOrigin(new StonetopFlags(actor, "origin"), actor);
		this._lore = new CharacterLore(new StonetopFlags(actor, "lore"));
		const outfitItems = new ActorOutfitItems(actor);
		this._resourceController = new ResourceController(new StonetopFlags(actor, "resources"));
		this._followers = new CharacterFollowers(new StonetopFlags(actor, "followers"), repos.followers, this._resourceController);
		this._choiceController = new ChoiceGroupController(
			new StonetopFlags(actor, "choices"),
			this._followers
		);
		this._instinct = new CharacterInstincts(new StonetopFlags(actor, "instinct"), this._choiceController);
		this._appearance = new CharacterAppearance(new StonetopFlags(actor, "appearance"), this._choiceController);
		this._background = new CharacterBackgrounds(new StonetopFlags(actor, "background"), this._followers, this._choiceController, this._resourceController);
		this._moves = new CharacterMoves(repos.moves, actor, this._choiceController, new ResourceController(new StonetopFlags(actor, "move-resources")));
		this._playbook = new CharacterPlaybook(actor, repos.playbook,
			this._background, this._instinct, this._appearance, this._origin, this._lore);
		this._possessions = new CharacterPossessions(new StonetopFlags(actor, "possessions"), this._moves, outfitItems, this._playbook);
		this._inventory = new CharacterInventory(new StonetopFlags(actor, "inventory"), repos.inventory, this._possessions, outfitItems, this._resourceController);
		this._vitals = new CharacterVitals(actor);
		this._debilities = new CharacterDebilities(actor);
		this._arcana = new CharacterArcana(new StonetopFlags(actor, "arcana"), repos.arcana, this._stats, outfitItems, this._followers);
		this._postDeath = new CharacterPostDeath(
			new StonetopFlags(actor, "postDeathInsert"),
			new CharacterInstincts(
				new StonetopFlags(actor, "postDeathInstinct"),
				new ChoiceGroupController(new StonetopFlags(actor, "postDeathChoices"), this._followers)
			),
			new CharacterLore(new StonetopFlags(actor, "postDeathLore")),
			repos.postDeathInsert,
			this._moves,
		);
		this._rolling = new CharacterRolling(actor, this._stats);
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
		const {checked} = this._inventory;
		const actor = this._actor;
		const followers = await this._followers.buildSnapshot();
		const [arcana, inventory, postDeath, playbook, vitals, moves] = await Promise.all([
			this._arcana.buildSnapshot(checked, this._resourceController),
			this._inventory.buildSnapshot(level),
			this._postDeath.buildSnapshot(),
			this._playbook.buildPlaybookSnapshot(),
			this._vitals.buildVitalsSnapshot(),
			this._moves.buildSnapshot(),
		]);
		return new CharacterSnapshotBuilder()
			.withName(actor.name)
			.withPlaybook(playbook)
			.withDebilities(this._rolling.buildDebilitiesSnapshot())
			.withStats(this._stats.buildStatsSnapshot())
			.withVitals(vitals)
			.withMoves(moves)
			.withInventory(inventory)
			.withArcana(arcana)
			.withPostDeathInsert(postDeath)
			.withFollowers(followers)
			.withRollMode(this._rolling.rollMode)
			.build();
	}

	async setPostDeathInsert(slug) {
		await this._postDeath.setInsert(slug);
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
		const arcana = items.filter(isArcanum);
		const followers = items.filter(i => i.type === "equipment" && i.system?.equipmentType === "follower");
		const moves = items.filter(i => i.type === "move");
		const others = items.filter(i => !isArcanum(i) && i.type !== "move" && i.system?.equipmentType !== "follower");
		let anyAdded = false;
		for (const item of arcana) {
			const slug = item.system?.slug;
			if (slug) {
				await this.addArcanum(slug);
				anyAdded = true;
			}
		}
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
		const playbookItem = documents.find(d => d.type === "playbook");
		if (playbookItem) {
			const playbookData = playbookItem.asPlaybook();
			await this._playbook.selectPlaybook(playbookData);
			const sp = playbookData.specialPossessions;
			for (const slug of sp?.preselected ?? []) {
				await this._possessions.syncPossessionItems(slug, sp);
			}
		}

		const insertItem = documents.find(d => d.type === "insert");
		if (insertItem) {
			await this._postDeath.setInsert(insertItem.system?.slug ?? null);
		}
	}

	get rollMode() {
		return this._rolling.rollMode;
	}

	getRollableStats() {
		return this._rolling.getRollableStats();
	}

	resolveBonus(rollStat) {
		return this._rolling.resolveBonus(rollStat);
	}

	applyRollMode(rollStat, rollMode) {
		return this._rolling.applyRollMode(rollStat, rollMode);
	}

	async rollStat(stat) {
		await this._rolling.rollStat(stat);
	}

	async setRollMode(mode) {
		await this._rolling.setRollMode(mode);
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

	async setArcanumBackChoiceValue(arcanumSlug, optionSlug, count) {
		await this._arcana.setBackChoiceValue(arcanumSlug, optionSlug, count);
	}

	async setBackgroundFollowerChoiceValue(groupSlug, optionSlug, count) {
		await this._background.setFollowerChoiceValue(groupSlug, optionSlug, count);
	}

	async setBackgroundResource(slug, count) {
		await this._background.setResource(slug, count);
	}

	async setChoiceCount(context, group, option, count) {
		switch (context) {
			case "arcana-unlock":
				return await this._arcana.setUnlockCount(group, option, count);
			case "lore":
				return await this._lore.set(group, option, count);
			case "pdi-lore":
				return await this._postDeath.lore.set(group, option, count);
			case "background":
				return await this._background.setChoiceValue(group, option, count);
			case "move":
				return await this._moves.setMoveChoiceCount(group, option, count);
		}
	}

	async setChoicePick(context, group, option, siblingsCsv, checked = true) {
		switch (context) {
			case "instinct":
				return this.instinct.selectOption(option, siblingsCsv);
			case "pdi-instinct":
				return await this._postDeath.instinct.selectOption(option, siblingsCsv);
			case "appearance":
				return this.appearance.selectOption(option, siblingsCsv);
			case "follower":
				return await this._followers.setChoiceValue(group, "choices", option, siblingsCsv);
			case "background":
				return this._background.setChoiceValue(group, option, checked ? 1 : 0);
		}
	}

	async setChoiceText(context, group, option, value) {
		switch (context) {
			case "lore":
				return await this._lore.set(group, option, value);
			case "pdi-lore":
				return await this._postDeath.lore.set(group, option, value);
			case "follower":
				return await this._followers.setChoiceText(group, option, value);
			case "move":
				return await this._moves.setMoveChoiceText(group, option, value);
		}
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
