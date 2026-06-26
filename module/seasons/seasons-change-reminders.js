import { escHtml } from "../utils/strings.js";
import { stonetopCardShell } from "../utils/chat.js";
import { getPlayerCharacters } from "../utils/playbook-actors.js";

// ── Seasons Change reminders ─────────────────────────────────────────────────
// A few playbook moves and special possessions have rules that fire "each
// season" / "once per season" (Book I). When the GM runs the Seasons Change move
// on the steading, a single public chat card lists every player character that
// carries one of these alongside its season-facing rule — so the seasonal upkeep
// doesn't get forgotten. The card is an ordinary ChatMessage, so it syncs to the
// whole table on its own (no socket needed).

// The seasonal upkeep registry. `kind` decides how a character is matched:
//   • "move"       — an embedded move Item with this exact name.
//   • "possession" — a selected special-possession slug (flags.stonetop.possessions.selected).
// `rule` is the season-facing reminder text shown in the card.
const SEASONAL_REMINDERS = [
	{
		kind:     "move",
		name:     "Rites of the Land",
		playbook: "The Blessed",
		rule:     "Once per season, when you oversee the sacred rites, hold 1 Favor. If you also sacrifice 1 Surplus, hold 4 Favor instead. Spend Favor in lieu of Stock, 1-for-1.",
	},
	{
		kind:     "possession",
		slug:     "collected-offerings",
		label:    "Collected offerings",
		playbook: "The Blessed",
		rule:     "Restore 1 use this season. (Expend a use to produce something valuable to a spirit of the wild.)",
	},
	{
		kind:     "possession",
		slug:     "goat-herd",
		label:    "Goat herd",
		playbook: "The Blessed",
		rule:     "Each season, there's a 1-in-4 chance your goat herd produces a bezoar — swallow it to cure poison. Roll to see if you have one.",
	},
	{
		kind:     "possession",
		slug:     "holy-relics",
		label:    "Holy relics",
		playbook: "The Lightbearer",
		rule:     "Restore 1 use this season. (Expend a use to add +1 to a roll involving Helior's favor or power.)",
	},
];

// Web-path season icon (the steading flow stores these under assets/icons/seasons;
// "autumn" maps to the "fall" art). Forward slashes keep it a valid URL.
export function seasonIconSrc(season) {
	const id = season === "autumn" ? "fall" : season;
	return `systems/stonetop/assets/icons/seasons/${id}_icon.svg`;
}

// The four seasons in turn order — the single source for the season picker and
// any other season-cycle UI, so ids/labels live in one place.
export const SEASON_IDS = ["spring", "summer", "autumn", "winter"];

export function seasonLabel(season) {
	return { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" }[season] ?? "A New Season";
}

// Which registered reminders apply to one character — a move match needs an
// embedded move Item of that name; a possession match needs the slug selected.
export function remindersForActor(actor) {
	if (actor?.type !== "character") return [];
	const moveNames = new Set(actor.items.filter(i => i.type === "move").map(i => i.name));
	const selected  = new Set(actor.getFlag?.("stonetop", "possessions.selected") ?? []);
	return SEASONAL_REMINDERS.filter(r =>
		r.kind === "move" ? moveNames.has(r.name) : selected.has(r.slug),
	);
}

// Display rows for every seasonal item carried by the given actors: the matched
// move/possession's season-facing rule, tagged with the owning character. Pure
// (no globals), so the card builder and the tests can drive it directly.
export function collectSeasonalReminders(actors) {
	return actors.flatMap(actor =>
		remindersForActor(actor).map(r =>
			({ character: actor.name, name: r.label ?? r.name, playbook: r.playbook, rule: r.rule })),
	);
}

// The public chat-card HTML for a season's upkeep reminders: a season hero plus an
// item per carried move/possession (name · owning character · rule). Reuses the
// `.stonetop-seasons-reminder-*` markup/styles inside the shared Stonetop chat shell.
export function seasonsReminderCard(season, reminders) {
	const items = reminders.map(r => `
			<li class="stonetop-seasons-reminder-item">
				<div class="stonetop-seasons-reminder-item-head">
					<span class="stonetop-seasons-reminder-item-name">${escHtml(r.name)}</span>
					<span class="stonetop-seasons-reminder-item-char">${escHtml(r.character)}</span>
				</div>
				<p class="stonetop-seasons-reminder-item-rule">${escHtml(r.rule)}</p>
			</li>`).join("");
	const body = `<div class="stonetop-seasons-reminder">
			<header class="stonetop-seasons-reminder-hero">
				<img class="stonetop-seasons-reminder-icon" src="${seasonIconSrc(season)}" alt="">
				<div class="stonetop-seasons-reminder-heading">
					<h2>The Seasons Change</h2>
					<span class="stonetop-seasons-reminder-season">${escHtml(seasonLabel(season))}</span>
				</div>
			</header>
			<p class="stonetop-seasons-reminder-lead">A new season has come to Stonetop. Don't forget your seasonal upkeep:</p>
			<ul class="stonetop-seasons-reminder-list">${items}</ul>
		</div>`;
	return stonetopCardShell(body, "stonetop-seasons-reminder-chat-card");
}

// GM side of the Seasons Change move: gather every player character's seasonal
// upkeep and post one public chat card for the table. A no-op when nothing in the
// party carries seasonal upkeep (so off-season parties get no empty card).
export function postSeasonsChangeReminder(season) {
	if (!globalThis.ChatMessage) return;
	const reminders = collectSeasonalReminders(getPlayerCharacters());
	if (!reminders.length) return;
	ChatMessage.create({
		speaker: { alias: "The Seasons Change" },
		content: seasonsReminderCard(season, reminders),
	});
}
