import { FrontOnOpen } from "../../../utils/front-on-open.js";
import { creatureTypeFaIcon } from "../../../bestiary/creature-types.js";
import {
	FOLLOWER_COST_EXAMPLES,
	monsterFollowerTags, normalizeTags, followerFromMonster,
} from "../../../data/follower-build.js";

// ── MonsterToFollowerDialog ──────────────────────────────────────────────────
// Dropping a monster onto a character sheet offers to convert it to a follower
// (Book I, NPCs & Followers, p.475): "use its stats as-is", but add any tags you
// see fit, choose a cost, and add a Loyalty track. This compact modal shows the
// monster's stats, lets the player add tags + pick a cost + set a pronoun, then
// hands the built follower back to the sheet to store (see _applyCustomFollower).

export class MonsterToFollowerDialog extends Application {
	constructor(actor, monster, onApply, options = {}) {
		super(options);
		this._actor     = actor;
		this._monster   = monster;
		this._onApply   = onApply;
		this._addedTags = [];
		this._cost      = "";
		this._pronoun   = "";
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-monster-to-follower",
			title:     "Convert to Follower",
			template:  "systems/stonetop/templates/dialogs/monster-to-follower.hbs",
			width:     520,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-spring-dialog", "stonetop-monster-follower-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
		this.setPosition({ height: "auto" });
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	// Monster move names (the monsterMove items), carried onto the follower.
	_monsterMoves() {
		return (this._monster?.items ?? [])
			.filter(i => i.type === "monsterMove")
			.map(i => i.name);
	}

	getData() {
		const m      = this._monster;
		const system = m?.system ?? {};
		const attrs  = system.attributes ?? {};
		return {
			monsterName: m?.name ?? "Monster",
			actorName:   this._actor?.name ?? "this character",
			bannerIcon:  creatureTypeFaIcon(system.creatureType),
			keptTags:    monsterFollowerTags(system),
			addedTags:   this._addedTags,
			hp:          attrs.hp?.max ?? attrs.hp?.value ?? 0,
			armor:       attrs.armor?.value ?? 0,
			damage:      String(attrs.damage?.value ?? attrs.damage?.rollFormula ?? "").trim() || "—",
			instinct:    String(attrs.instinct?.value ?? "").trim(),
			moves:       this._monsterMoves(),
			pronoun:     this._pronoun,
			costOptions: FOLLOWER_COST_EXAMPLES.map(c => ({ value: c, selected: this._cost === c })),
			cost:        this._cost,
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();

		html.find(".stonetop-mf-cancel").on("click", () => this.close());
		html.find(".stonetop-mf-create").on("click", () => this._finish());

		// Added tags: chips toggle off, free input adds.
		html.find(".stonetop-mf-added-tag").on("click", ev => this._removeTag(ev.currentTarget.dataset.tag));
		html.find(".stonetop-mf-tag-add").on("click", () => this._addTagFromInput(html));
		html.find(".stonetop-mf-tag-input").on("keydown", ev => {
			if (ev.key === "Enter") { ev.preventDefault(); this._addTagFromInput(html); }
		});

		// Cost: example chip sets it; free input overrides.
		html.find(".stonetop-mf-cost-ex").on("click", ev => { this._cost = ev.currentTarget.dataset.value; this.render(false); });
		html.find(".stonetop-mf-cost-input").on("change", ev => { this._cost = ev.currentTarget.value; });

		html.find(".stonetop-mf-pronoun").on("change", ev => { this._pronoun = ev.currentTarget.value; });
	}

	_removeTag(tag) {
		const t = String(tag ?? "").toLowerCase();
		this._addedTags = this._addedTags.filter(x => x.toLowerCase() !== t);
		this.render(false);
	}

	_addTagFromInput(html) {
		const input = html.find(".stonetop-mf-tag-input")[0];
		if (!input) return;
		// De-dupe against the monster's kept tags too, so an added tag can't double.
		const kept = monsterFollowerTags(this._monster?.system ?? {});
		const merged = normalizeTags([...this._addedTags, ...normalizeTags(input.value)])
			.filter(t => !kept.some(k => k.toLowerCase() === t.toLowerCase()));
		this._addedTags = merged;
		input.value = "";
		this.render(false);
	}

	async _finish() {
		// Capture an un-blurred custom cost / pronoun.
		const root = this.element?.[0];
		if (root) {
			const costEl = root.querySelector(".stonetop-mf-cost-input");
			if (costEl && costEl.value.trim()) this._cost = costEl.value.trim();
			const pronEl = root.querySelector(".stonetop-mf-pronoun");
			if (pronEl) this._pronoun = pronEl.value;
		}
		const data = followerFromMonster(
			{ name: this._monster?.name, system: this._monster?.system, moves: this._monsterMoves(), uuid: this._monster?.uuid },
			{ tags: this._addedTags, cost: this._cost, pronoun: this._pronoun },
		);
		await this._onApply?.(data);
		ui.notifications?.info?.(`${data.name || "Monster"} converted to a follower.`);
		this.close();
	}
}
