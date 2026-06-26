import { FrontOnOpen } from "../../../utils/front-on-open.js";
import { orderFollowersBonus } from "../../../data/follower-build.js";
import { sign } from "../../../utils/roll-engine.js";

// ── OrderFollowersDialog ─────────────────────────────────────────────────────
// Direct a follower to make a move (Book I, NPCs & Followers p.462: "Order
// Followers"). A follower doesn't roll +STAT — it rolls 2d6 plus a bonus the
// player resolves from the follower's tags: +1 if any apply, +2 if it's also
// exceptional, +0 if none; with disadvantage if a tag would get in the way.
//
// Since "which tags apply / get in the way" is a table judgment call, this modal
// lists the follower's tags as tri-state chips (helps / hinders / neither) plus
// an exceptional indicator and an optional advantage toggle, computes the bonus
// live (orderFollowersBonus), then hands { bonus, rollMode, moveName } back to the
// caller (which calls StonetopCharacter.onOrderFollowersRoll).

// The basic moves a follower can be ordered to trigger (the rollable ones from
// packs/src/stonetop-items/basic-moves/). "Custom" reveals a free-text header for
// anything else (a playbook move's effect, an improvised action, etc.).
const _ORDER_MOVES = [
	{ key: "defy-danger",   label: "Defy Danger" },
	{ key: "clash",         label: "Clash" },
	{ key: "let-fly",       label: "Let Fly" },
	{ key: "defend",        label: "Defend" },
	{ key: "aid",           label: "Aid" },
	{ key: "interfere",     label: "Interfere" },
	{ key: "seek-insight",  label: "Seek Insight" },
	{ key: "know-things",   label: "Know Things" },
	{ key: "persuade-npcs", label: "Persuade NPCs" },
	{ key: "custom",        label: "Custom / other…" },
];

export class OrderFollowersDialog extends Application {
	/**
	 * @param {Actor}    actor
	 * @param {object}   follower  - { name, tags: string[], exceptional: bool }
	 * @param {Function} onRoll    - async ({ bonus, rollMode, moveName }) => void
	 */
	constructor(actor, follower, onRoll, options = {}) {
		super(options);
		this._actor     = actor;
		this._follower  = follower ?? {};
		this._onRoll    = onRoll;
		this._frontOnOpen = new FrontOnOpen(this);

		this._moveKey    = "defy-danger";
		this._customMove = "";
		// Per-tag state: "help" | "hinder" | "" (neither). Keyed by tag string.
		this._tagState   = {};
		this._advantage  = false;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-order-followers",
			title:     "Order Followers",
			template:  "systems/stonetop/templates/dialogs/order-followers.hbs",
			width:     460,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-spring-dialog", "stonetop-order-followers-dialog"],
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

	// Live tallies the player's tri-state picks into the Order Followers result.
	_result() {
		const states  = Object.values(this._tagState);
		const helps   = states.filter(s => s === "help").length;
		const hinders = states.filter(s => s === "hinder").length;
		return orderFollowersBonus({
			helps, hinders,
			exceptional: !!this._follower.exceptional,
			advantage:   this._advantage,
		});
	}

	_moveLabel() {
		if (this._moveKey === "custom") return this._customMove.trim() || "act";
		return _ORDER_MOVES.find(m => m.key === this._moveKey)?.label ?? "act";
	}

	getData() {
		const { bonus, rollMode } = this._result();
		const signedBonus = sign(bonus);
		const modeNote = rollMode === "dis" ? ", with disadvantage"
			: rollMode === "adv" ? ", with advantage" : "";
		const dice = rollMode === "dis" ? "3d6 (keep lowest 2)"
			: rollMode === "adv" ? "3d6 (keep highest 2)" : "2d6";
		return {
			followerName: this._follower.name || "your follower",
			exceptional:  !!this._follower.exceptional,
			moves:        _ORDER_MOVES.map(m => ({ ...m, selected: m.key === this._moveKey })),
			isCustom:     this._moveKey === "custom",
			customMove:   this._customMove,
			tags: (this._follower.tags ?? []).map(tag => ({
				tag,
				help:    this._tagState[tag] === "help",
				hinder:  this._tagState[tag] === "hinder",
				neither: !this._tagState[tag],
			})),
			advantage:    this._advantage,
			advDisabled:  rollMode === "dis",   // a hindering tag forces disadvantage
			readout:      `Roll ${dice} ${signedBonus}${modeNote}`,
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();

		html.find(".stonetop-of-move").on("change", ev => {
			this._moveKey = ev.currentTarget.value;
			this.render(false);
		});
		html.find(".stonetop-of-custom").on("change", ev => { this._customMove = ev.currentTarget.value; });

		// Tri-state tag chip: cycles neither → helps → hinders → neither.
		html.find(".stonetop-of-tag").on("click", ev => {
			const tag = ev.currentTarget.dataset.tag;
			const cur = this._tagState[tag] ?? "";
			this._tagState[tag] = cur === "" ? "help" : cur === "help" ? "hinder" : "";
			this.render(false);
		});

		html.find(".stonetop-of-adv").on("change", ev => { this._advantage = ev.currentTarget.checked; this.render(false); });

		html.find(".stonetop-of-roll").on("click", () => this._finish());
		html.find(".stonetop-of-cancel").on("click", () => this.close());
	}

	async _finish() {
		// Capture an un-blurred custom-move field.
		const root = this.element?.[0];
		const customEl = root?.querySelector(".stonetop-of-custom");
		if (customEl) this._customMove = customEl.value;

		const { bonus, rollMode } = this._result();
		const moveName = `${this._follower.name || "Follower"}: ${this._moveLabel()}`;
		await this._onRoll?.({ bonus, rollMode, moveName });
		this.close();
	}
}
