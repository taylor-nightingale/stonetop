import {isDefaultImg, escHtml} from "../utils/strings.js";
import {stonetopChatCard} from "../utils/chat.js";
import {STONETOP_SCOPE, resolvedFlagProperty} from "../actors/character/StonetopFlags.js";

const _OMEN_REMINDER_FLAG = "lastOmenReminder";

const _STEADING_ACTOR_TYPE = "stonetop";
const _STEADING_ACTOR_NAME = "Stonetop";
const _STEADING_ACTOR_IMG = "systems/stonetop/assets/stonetop_image.webp";
const _LEGACY_STEADING_ACTOR_IMAGES = new Set([
	"systems/stonetop/assets/stonetop_image.webp",
	"/systems/stonetop/assets/stonetop_image.webp",
	"systems/stonetop/assets/stonetop_image.png",
	"/systems/stonetop/assets/stonetop_image.png",
	"systems/stonetop/assets/stonetop_image.png",
	"/systems/stonetop/assets/stonetop_image.png",
]);

export async function ensureStonetopSingleton() {
	if (!game.user.isGM || !_isPrimaryGM()) return;
	const existing = _getStonetopActors().at(0);
	if (existing) {
		await _ensureStartingValues(existing);
		return;
	}

	await Actor.create({
		name: _STEADING_ACTOR_NAME,
		type: _STEADING_ACTOR_TYPE,
		img: _STEADING_ACTOR_IMG,
		// The steading is shared: every player owns it so they can edit it directly
		// (e.g. requisitioning assets, tracking Fortunes) without GM relaying.
		ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
		prototypeToken: {
			texture: { src: _STEADING_ACTOR_IMG },
		},
		system: {
			attributes: {
				surplus: { value: 1 },
			},
		},
	});
}

export function registerStonetopSingletonHooks() {
	Hooks.on("preCreateActor", (actor, data) => {
		if (!_isStonetopActorData(data ?? actor)) return;
		if (!_getStonetopActors().length) return;

		ui.notifications?.warn("This world already has a Stonetop sheet.");
		return false;
	});

	Hooks.on("preDeleteActor", actor => {
		if (!_isStonetopActorData(actor)) return;
		if (_getStonetopActors().length > 1) return;

		ui.notifications?.warn("The Stonetop sheet is required and cannot be deleted.");
		return false;
	});
}

// Start-of-session reminder: any Would-Be Hero with the Destined background must
// roll +Omens at the start of each session. Foundry has no session event, so we
// fire on world `ready` (primary GM only) and throttle to once per real-world day
// via a flag on the Stonetop singleton; ending a session clears it so a new
// same-day session reminds again.
export async function remindDestinedOmenRoll() {
	if (!_isPrimaryGM()) return;
	if (!game.settings?.get?.(STONETOP_SCOPE, "startOfSessionReminders")) return;
	const destined = game.actors?.filter(a =>
		a.type === "character" && resolvedFlagProperty(a, "background.selected") === "destined") ?? [];
	if (!destined.length) return;

	const steading = _getStonetopActors().at(0);
	const today = new Date().toDateString();
	if (steading?.getFlag(STONETOP_SCOPE, _OMEN_REMINDER_FLAG) === today) return;

	await ChatMessage.create({
		content: _buildOmenReminderContent(destined),
		speaker: { alias: "Stonetop" },
	});
	if (steading) await steading.setFlag(STONETOP_SCOPE, _OMEN_REMINDER_FLAG, today);
}

// Clear the throttle so the next `ready` re-posts the reminder (called at End of Session).
export async function resetOmenReminder() {
	const steading = _getStonetopActors().at(0);
	if (steading?.getFlag(STONETOP_SCOPE, _OMEN_REMINDER_FLAG)) {
		await steading.unsetFlag(STONETOP_SCOPE, _OMEN_REMINDER_FLAG);
	}
}

function _buildOmenReminderContent(destined) {
	const names = destined.map(a => escHtml(a.name)).join(", ");
	return stonetopChatCard("Start of Session — Omen Roll",
		`<div class="stonetop-roll-card-description">
			<p><strong>Destined:</strong> ${names} — roll <strong>+Omens</strong>.</p>
			<ul>
				<li><strong>7+:</strong> lose all Omens; the GM shares a vision or portent that points toward your fate.</li>
				<li><strong>10+:</strong> also ask the GM a follow-up question and get a clear, helpful answer.</li>
				<li><strong>6-:</strong> don't mark XP, hold +1 Omen, and tell us of your recent nightmares or a troubling vision.</li>
			</ul>
		</div>`);
}

function _getStonetopActors() {
	return game.actors?.filter(actor => _isStonetopActorData(actor)) ?? [];
}

function _isStonetopActorData(actor) {
	return actor?.type === _STEADING_ACTOR_TYPE || actor?.system?.customType === _STEADING_ACTOR_TYPE;
}

async function _ensureStartingValues(actor) {
	const updates = {};
	if (actor.system?.attributes?.surplus?.value === undefined || actor.system.attributes.surplus.value === null) {
		updates["system.attributes.surplus.value"] = 1;
	}
	if (_shouldReplaceSteadingImg(actor.img)) updates.img = _STEADING_ACTOR_IMG;
	if (_shouldReplaceSteadingImg(actor.prototypeToken?.texture?.src)) updates["prototypeToken.texture.src"] = _STEADING_ACTOR_IMG;
	// Keep the shared steading owned by all players (preserves any per-user overrides).
	if (actor.ownership?.default !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
		updates["ownership.default"] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
	}
	if (Object.keys(updates).length) await actor.update(updates);
}

function _shouldReplaceSteadingImg(img) {
	return isDefaultImg(img) || _LEGACY_STEADING_ACTOR_IMAGES.has(img);
}

function _isPrimaryGM() {
	const activeGM = game.users?.activeGM;
	if (activeGM) return activeGM.id === game.user.id;

	const firstActiveGM = game.users?.find(user => user.active && user.isGM);
	return !firstActiveGM || firstActiveGM.id === game.user.id;
}
