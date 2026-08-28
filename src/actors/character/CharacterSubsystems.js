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
import {PlaybookSelection} from "./PlaybookSelection.js";
import {ActorOutfitItems} from "./ActorOutfitItems.js";
import {ChoiceGroupControllerFactory} from "./ChoiceGroupControllerFactory.js";
import {ContainerOutfitSync} from "./ContainerOutfitSync.js";
import {FollowerSideEffectHandler} from "./SideEffectHandler.js";
import {InstinctSideEffectHandler} from "./InstinctSideEffectHandler.js";
import {ArcanumSideEffectHandler} from "./ArcanumSideEffectHandler.js";
import {GrantedItems} from "../GrantedItems.js";
import {MoveRequirements} from "../../model/data/MoveRequirements.js";

/**
 * Builds a character's subsystems. Construction only — nothing here answers a question about a
 * character, and StonetopCharacter does no assembling.
 *
 * Every dependency is a constructor argument, so the order below is not a convention a reader has to
 * preserve: it is forced. That is only possible because the graph is acyclic, which is the property
 * tests/actors/character/characterGraph.test.js exists to keep true.
 */
export class CharacterSubsystems {
	static build(actor, repos) {
		// ── Leaves: the actor and nothing else ───────────────────────────────────────────────────
		const stats     = new CharacterStats(actor);
		const origin    = new CharacterOrigin(actor);
		const vitals    = new CharacterVitals(actor);
		const playbookSelection = new PlaybookSelection(actor);
		const debilities = new CharacterDebilities(actor);

		// ── Shared writers: one instance each, so "what created this item?" has a single answer ──
		const grantedItems       = new GrantedItems(actor);
		const outfitItems        = new ActorOutfitItems(actor, grantedItems);
		const resourceController = new ResourceController(actor);
		const outfitSync = new ContainerOutfitSync(outfitItems)
			.register("possession", CharacterPossessions.outfitGrantFor)
			.register("arcanum",    CharacterArcana.outfitGrantFor);
		const factory = new ChoiceGroupControllerFactory(actor);

		// ── Subsystems, in dependency order ──────────────────────────────────────────────────────
		const followers   = new CharacterFollowers(actor, repos.followers, resourceController, factory, repos.inventory, grantedItems, repos.inventoryPage);
		const background  = new CharacterBackgrounds(actor, factory, resourceController);
		const requirements = new MoveRequirements(vitals, playbookSelection, repos.moves, repos.playbooks);
		const moves       = new CharacterMoves(repos.moves, actor, new ResourceController(actor, "moveResources"), factory, grantedItems, requirements);
		const playbook    = new CharacterPlaybook(actor, background, factory, origin, vitals, moves, playbookSelection);
		const possessions = new CharacterPossessions(actor, moves, repos.possessions, factory, outfitSync, grantedItems);
		const inventory   = new CharacterInventory(actor, repos.inventory, outfitItems, resourceController, repos.steading, repos.inventoryPage);
		const arcana      = new CharacterArcana(actor, repos.arcana, stats, followers, factory, moves, outfitSync, grantedItems);
		const inserts     = new CharacterInserts(actor, factory, moves, repos.inserts, grantedItems);

		// ── What reacts to a choice value changing. Registered once, after everything exists, so no
		//    handler can fire against a half-built graph. Each subscriber decides its own relevance.
		factory.subscribe(new FollowerSideEffectHandler(followers))
		       .subscribe(outfitSync)
		       .subscribe(new InstinctSideEffectHandler(playbook))
		       .subscribe(new ArcanumSideEffectHandler(arcana));

		return {
			stats, origin, vitals, selection: playbookSelection, debilities,
			grantedItems, outfitItems, resourceController, outfitSync, factory,
			followers, background, moves, playbook, possessions, inventory, arcana, inserts,
		};
	}
}
