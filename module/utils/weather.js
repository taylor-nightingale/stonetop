import { stonetopCardShell, rollFormulaChip } from "./chat.js";

// Stonetop's seasonal weather tables (Book I, p.325). Each season is a 1d6 table;
// the GM picks the season (informed by the latest Seasons Change move, p.517) and
// rolls. A few results carry a "roll again later with disadvantage" rider, which
// we surface as `reroll` so the card can call it out.
//
// The pure data + resolver live here (and are unit-tested); the picker UI is
// WeatherDialog, and the hotbar macro opens it (see hooks/Ready.js).

const REROLL_NOTE = "Roll again later with disadvantage.";

export const WEATHER_SEASONS = [
	{
		key:   "late-winter-early-spring",
		label: "Late winter / early spring",
		rows:  [
			{ min: 1, max: 1, text: "Snow / sleet / hail, an early thunderstorm, or a day of cold, soaking rains" },
			{ min: 2, max: 3, text: "Cold and windy, maybe some showers" },
			{ min: 4, max: 4, text: "Clouds on the horizon, steady wind", reroll: true },
			{ min: 5, max: 6, text: "A fine, sunny spring day; some clouds, some gusting winds" },
		],
	},
	{
		key:   "spring-early-summer",
		label: "Spring / early summer",
		rows:  [
			{ min: 1, max: 1, text: "A heavy storm; high winds, hail, thunder, lightning" },
			{ min: 2, max: 2, text: "Steady, chilly rain" },
			{ min: 3, max: 4, text: "Warm and windy, maybe some brief showers" },
			{ min: 5, max: 6, text: "Warm, sunny, pleasant" },
		],
	},
	{
		key:   "summer",
		label: "Summer",
		rows:  [
			{ min: 1, max: 1, text: "A heavy storm; high winds, hail, thunder, lightning, tornadoes" },
			{ min: 2, max: 2, text: "Blazing heat, still air, not a cloud in sight" },
			{ min: 3, max: 3, text: "Hot and humid, with brief, drenching thunderstorms" },
			{ min: 4, max: 5, text: "Hot, muggy, some wind" },
			{ min: 6, max: 6, text: "Warm, sunny, breezy, perfect" },
		],
	},
	{
		key:   "late-summer-early-autumn",
		label: "Late summer / early autumn",
		rows:  [
			{ min: 1, max: 1, text: "A powerful thunderstorm or cold, soaking rain" },
			{ min: 2, max: 2, text: "Windy with a few rain showers" },
			{ min: 3, max: 3, text: "Warm, clouds on the horizon, steady wind", reroll: true },
			{ min: 4, max: 5, text: "Hot and dry during the day; cooler and windy at night" },
			{ min: 6, max: 6, text: "Warm, sunny, breezy, perfect" },
		],
	},
	{
		key:   "autumn",
		label: "Autumn",
		rows:  [
			{ min: 1, max: 1, text: "Cold, drenching rain and/or sleet" },
			{ min: 2, max: 2, text: "Cold, windy, light rain or early snow" },
			{ min: 3, max: 3, text: "Chilly, windy, clouds on the horizon", reroll: true },
			{ min: 4, max: 6, text: "Crisp, breezy" },
		],
	},
	{
		key:   "winter",
		label: "Winter",
		rows:  [
			{ min: 1, max: 1, text: "Blizzard: wind, snow, all of it" },
			{ min: 2, max: 2, text: "Intense cold and wind" },
			{ min: 3, max: 3, text: "Very cold, very clear, very still" },
			{ min: 4, max: 4, text: "Cold and snowy, or cold and windy" },
			{ min: 5, max: 5, text: "Some snow, but mostly just dreary" },
			{ min: 6, max: 6, text: "Warm (for winter) and sunny" },
		],
	},
];

/** Look up a season table by its key. */
export function getWeatherSeason(key) {
	return WEATHER_SEASONS.find(s => s.key === key) ?? null;
}

/** The row a given 1d6 total lands on for a season (or null if the key is unknown). */
export function resolveWeatherRow(seasonKey, total) {
	const season = getWeatherSeason(seasonKey);
	return season?.rows.find(r => total >= r.min && total <= r.max) ?? null;
}

/** Human-readable range label for a row, e.g. "1" or "2–3". */
export function rowRange(row) {
	return row.min === row.max ? `${row.min}` : `${row.min}–${row.max}`;
}

/**
 * Roll 1d6 on a season's weather table and post a result card to chat.
 * Returns the rolled total + row (handy for the dialog to highlight).
 */
export async function rollWeather(seasonKey) {
	const season = getWeatherSeason(seasonKey);
	if (!season) return null;

	const roll = await new Roll("1d6").evaluate();
	const row  = resolveWeatherRow(seasonKey, roll.total);

	await roll.toMessage({
		speaker: { alias: `Weather — ${season.label}` },
		flavor:  stonetopCardShell(_weatherCardBody(roll.total, row, roll.formula), "stonetop-weather-card"),
	});

	return { total: roll.total, row };
}

// We render the result ourselves (number + table text + the d6 formula) and hide
// Foundry's auto-rendered dice block in CSS, so the rolled total isn't shown twice.
function _weatherCardBody(total, row, formula) {
	const reroll = row?.reroll
		? `<p class="stonetop-weather-reroll"><i class="fas fa-rotate-right"></i> ${REROLL_NOTE}</p>`
		: "";
	return `<div class="card-content stonetop-weather">
		${rollFormulaChip(formula)}
		<div class="stonetop-weather-result">
			<span class="stonetop-weather-number">${total}</span>
			<span class="stonetop-weather-text">${row?.text ?? ""}</span>
		</div>
		${reroll}
	</div>`;
}

export { REROLL_NOTE };
