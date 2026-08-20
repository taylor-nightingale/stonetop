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
import {ChoiceGroupControllerFactory} from "./ChoiceGroupControllerFactory.js";
import {ContainerOutfitSync} from "./ContainerOutfitSync.js";
import {FollowerSideEffectHandler} from "./SideEffectHandler.js";
import {InstinctSideEffectHandler} from "./InstinctSideEffectHandler.js";
import {ChoiceStores} from "./ChoiceStores.js";
import {applyPick} from "./ChoiceGroupController.js";
import {GrantedItems} from "../GrantedItems.js";
import {ItemGrantRouter} from "./ItemGrantRouter.js";
import {GrantSource} from "../../model/data/ItemGrant.js";

export class StonetopCharacter {
	constructor(actor, repos) {
		this._actor = actor;
		this._playbookRepo = repos.playbooks ?? null;
		this._steadingRepo = repos.steading ?? null;
		this._stats = new CharacterStats(actor);
		this._origin = new CharacterOrigin(actor);
		// The one writer of items something else owns. Every subsystem grants through this instance, so
		// "which items exist because of X?" has a single answer.
		const grantedItems = this._grantedItems = new GrantedItems(actor);
		const outfitItems = new ActorOutfitItems(actor, grantedItems);
		this._resourceController = new ResourceController(actor);
		// The one writer of granted outfit items. Each container type registers how it computes its
		// grant; the factory re-syncs a container after every choice write.
		const outfitSync = new ContainerOutfitSync(outfitItems)
			.register("possession", CharacterPossessions.outfitGrantFor)
			.register("arcanum",    CharacterArcana.outfitGrantFor);
		const factory = new ChoiceGroupControllerFactory(actor);
		this._followers = new CharacterFollowers(actor, repos.followers, this._resourceController, factory, repos.inventory, grantedItems);
		// Everything that reacts to a choice value changing, in one list. Each decides what it cares about.
		factory.subscribe(new FollowerSideEffectHandler(this._followers))
		       .subscribe(outfitSync);

		this._background  = new CharacterBackgrounds(actor, factory, this._resourceController);
		this._moves       = new CharacterMoves(repos.moves, actor, new ResourceController(actor, "moveResources"), factory, grantedItems);
		this._playbook    = new CharacterPlaybook(actor, this._background, factory, this._origin);
		factory.subscribe(new InstinctSideEffectHandler(this._playbook));
		this._possessions = new CharacterPossessions(actor, this._moves, repos.possessions, factory, outfitSync, grantedItems);
		this._inventory   = new CharacterInventory(actor, repos.inventory, outfitItems, this._resourceController, repos.steading);
		this._vitals      = new CharacterVitals(actor);
		this._debilities  = new CharacterDebilities(actor);
		this._arcana      = new CharacterArcana(actor, repos.arcana, this._stats, this._followers, factory, this._moves, outfitSync, grantedItems);
		this._inserts     = new CharacterInserts(actor, factory, this._moves, repos.inserts, grantedItems);
		this._playbook.setVitals(this._vitals);
		this._playbook.setMoves(this._moves);
		this._moves.setVitals(this._vitals);

		// Where an item that lands on the character turns into grants, and — off the same registration,
		// so the two can't drift — what leaves when it goes. Each host still owns what its own type
		// grants; only the applying is shared.
		this._grantRouter = new ItemGrantRouter(grantedItems)
			.register("playbook", {
				source:  item => GrantSource.playbook(item.system?.slug),
				onApply: async item => this._playbook.selectPlaybook(item.asPlaybook()),
				// Four independent compendium reads: resolved together, the drop costs the slowest rather
				// than the sum.
				grants:  async item => {
					const playbook = item.asPlaybook();
					return Promise.all([
						this._playbook.moveGrants(playbook),
						this._followers.playbookGrants(playbook.slug, playbook.followers),
						this._inserts.playbookGrants(playbook.slug, playbook.inserts),
						this._possessions.playbookGrants(playbook.specialPossessions, playbook.slug),
					]);
				},
				onGranted: async created => {
					for (const item of created) await this._onGrantedItemCreated(item);
				},
				onRevoke: async source => this._possessions.clearGrantedOutfit(source),
			})
			.register("insert", {
				source:  item => GrantSource.insert(item.system?.slug),
				onApply: async item => this._inserts.onInsertDropped(item),
				grants:  async () => [],
			})
			.register("arcanum", {
				source:  item => GrantSource.arcanum(item.system?.slug),
				onApply: async item => this._arcana.syncSideEffectsFor(item),
				grants:  async item => this._arcana.arcanumGrants(item),
			});

		// Where a choice write goes, keyed by the context its row was rendered in. Each host owns how
		// its own rows find their document; nothing here knows what an arcanum or an insert is. A new
		// choice-bearing type is one more line, not an edit to the routing.
		this._choiceStores = new ChoiceStores()
			.register("possession",  t => this._possessions.controllerFor(t.possessionSlug))
			.register("arcana",      t => this._arcana.controllerFor(t.arcanumSlug))
			.register(["insert", "insert-pick"], t => this._inserts.controllerFor(t.insertItemId, t.group))
			.register("move",        t => this._moves.controllerFor(t.moveSlug))
			.register("follower",    t => this._followers.controllerFor(t.followerSlug))
			.register("background",  () => this._background.controller())
			.register("instinct",    () => this._playbook.instinctController())
			.register(["lore", "appearance", "intro-npc", "intro-pc"], () => this._playbook.controller());
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
		const [arcana, outfit, inserts, playbook, playbookData, armorBreakdown, moves, possessions, followers] = await Promise.all([
			this._arcana.buildSnapshot(checked, this._resourceController),
			this._inventory.buildSnapshot(level),
			this._inserts.buildSnapshot(),
			this._playbook.buildPlaybookSnapshot(),
			this._playbook.getData(),
			this._inventory.getArmorBreakdown(),
			this._moves.buildSnapshot(),
			this._possessions.buildSnapshot(level),
			this._followers.buildFollowersSnapshot()
		]);
		const vitals = await this._vitals.buildVitalsSnapshot(playbookData, armorBreakdown);
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

	async setInventoryRegularPool(count) {
		await this._inventory.setRegularPool(count);
	}

	async setInventorySmallPool(count) {
		await this._inventory.setSmallPool(count);
	}

	async resetOutfit() {
		await this._inventory.clearSelections();
	}

	async setInventoryOtherItems(value) {
		await this._inventory.setOtherItems(value);
	}

	// The sheet's per-move chat button: owned move items first (moves tab, side-bar, major-arcana
	// moves), then the inline arcanum moves that have no item behind them.
	async sendMoveToChat(moveSlug) {
		if (await this._moves.sendToChat(moveSlug)) return;
		await this._arcana.sendArcanumMoveToChat(moveSlug);
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

	async setPossessionUses(slug, count) {
		await this._possessions.setUses(slug, count);
	}

	async setSubChoiceUses(possessionSlug, choiceSlug, count) {
		await this._possessions.setChoiceUses(possessionSlug, choiceSlug, count);
	}

	async selectBackground(slug) {
		await this._playbook.selectBackground(slug);
	}

	/**
	 * The character's instinct, written in by hand. An insert has a box of its own: what is typed
	 * there is saved on the insert AND becomes the character's instinct — the mirroring is the
	 * insert's choice-write side effect, so a picked option travels the same road as a typed one.
	 */
	async selectCustomInstinct(text, insertItemId = null) {
		if (insertItemId) return this._inserts.selectCustomInstinct(insertItemId, text);
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
		if (toEmbed.length) await this._grantedItems.addAuthored(toEmbed);
		return toEmbed;
	}

	// The playbook dropdown: look the item up by slug (pack first, then world) and run it through
	// the same path a dropped playbook item takes.
	async applyPlaybookBySlug(slug) {
		if (!slug) return;
		const data = await this._playbookRepo.findItemDataBySlug(slug);
		if (data) await this.applyDroppedItems([data]);
	}

	// Every playbook the sheet's picker can offer. Served from the character's own repository so the
	// pack index and parsed-playbook cache are shared with applyPlaybookBySlug.
	async listPlaybooks() {
		return this._playbookRepo?.getAllPlaybooks() ?? [];
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
		for (const item of documents) await this._grantRouter.apply(item);
	}

	// A granted item can be a source in its own right — an insert a playbook hands you brings its moves —
	// or need follow-up only a new item needs. Foundry fires the create hook for these too, so both paths
	// have to be idempotent; they are, because every grant is a diff.
	async _onGrantedItemCreated(item) {
		await this._grantRouter.apply(item);
		await this._possessions.onCreated(item);
	}

	async _onDeleteDescendantDocuments(documents) {
		for (const item of documents) await this._grantRouter.revoke(item);
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

	// A character rolls its own six stats. Anything else belongs to something the character is tied
	// to, so the lookup falls down the chain: an insert's own track (the Thrall's Favor, rolled by
	// Dark Succor), then the steading it calls home (Requisition's +Fortunes). Null when nothing
	// answers — ActorRolling reads that as "can't roll this" and posts the move's text instead.
	resolveBonus(stat) {
		return this._stats.resolveBonus(stat)
			?? this._inserts.resolveBonus(stat)
			?? this._homeSteading?.resolveBonus(stat)
			?? null;
	}

	get _homeSteading() {
		return this._steadingRepo?.getPrimary() ?? null;
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

	async setArcanumBlank(arcanumSlug, key, text) {
		await this._arcana.setBlankValue(arcanumSlug, key, text);
	}

	/** Map of arcanum slug → its write-in blanks, built in one pass. */
	getAllArcanumBlanks() {
		return this._arcana.allBlanks();
	}

	async setBackgroundResource(slug, count) {
		await this._background.setResource(slug, count);
	}

	async setArcanumResource(slug, count) {
		await this._inventory.setResource(slug, count);
	}

	// --- ChoiceTarget routing -----------------------------------------------------------------
	// The sheet builds a ChoiceTarget from the row's DOM containers; `_choiceStores` turns the row's
	// context into the controller to write through. The group the row was stamped with IS the
	// namespace, so these three methods are all the routing there is.

	// Track checkboxes: checking box `index` fills the track through index+1; unchecking empties
	// back to index.
	async setChoiceTrackFor(target, index, checked) {
		const count = checked ? Number(index) + 1 : Number(index);
		await this.setChoiceCountFor(target, count);
	}

	async setChoiceCountFor(target, count) {
		return this._choiceStores.resolve(target)?.setCount(target.group, target.option, count);
	}

	// A row's siblings csv is what makes a pick exclusive: with siblings, choosing one clears the rest;
	// without them the pick is an independent checkbox that can also be cleared.
	async setChoicePickFor(target, checked = true) {
		if (!target.context) return;
		const ctrl = this._choiceStores.resolve(target);
		return ctrl ? applyPick(ctrl, target, checked) : undefined;
	}

	async setChoiceTextFor(target, text) {
		return this._choiceStores.resolve(target)?.setText(target.group, target.option, text);
	}

	// Re-clicking the option a "pick 1" row already holds releases it — radios cannot be unticked, so
	// without this a pick made by mistake is permanent. Zero rather than a dropped key: Foundry
	// deep-merges an update, so omitting it would leave the old value in place.
	async clearChoicePickFor(target) {
		return this.setChoiceCountFor(target, 0);
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

	async setPossessionSelected(slug, selected)   {
		if (selected) return this.selectPossession(slug);
		return this.deselectPossession(slug);
	}

	async toggleArcanumFlip(slug, currentlyFlipped) {
		if (currentlyFlipped) return this.unflipArcanum(slug);
		return this.flipArcanum(slug);
	}

	// --- Shared-inventory routing ------------------------------------------------------------
	// A shared outfit item lives in the character's inventory tab OR inside a follower card; the
	// InventoryOwner the sheet read off the row says which, and these route on it.

	async setInventoryItemCheckedFor(owner, itemSlug, checked) {
		if (owner.isFollower) return this.setFollowerInvItemChecked(owner.followerSlug, itemSlug, checked);
		return this.setInventoryItemChecked(itemSlug, checked);
	}

	async toggleInventoryResourcePipFor(owner, itemSlug, index, isChecked) {
		const count = this.#pipCount(index, isChecked);
		if (owner.isFollower) return this.setFollowerInvResource(owner.followerSlug, itemSlug, count);
		return this.setInventoryResource(itemSlug, count);
	}

	async addCustomInventoryItemFor(owner, item) {
		if (owner.isFollower) return this.addFollowerInvCustomItem(owner.followerSlug, item.name, item.weight);
		if (item.isRegular)   return this.addCustomInventoryItem(item.name, item.weight);
		return this.addCustomSmallItem(item.name);
	}

	async removeCustomInventoryItemFor(owner, itemId) {
		if (owner.isFollower) return this.removeFollowerInvCustomItem(owner.followerSlug, itemId);
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

	async setFollowerLoadCapacity(slug, capacity) {
		await this._followers.setLoadCapacity(slug, capacity);
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
