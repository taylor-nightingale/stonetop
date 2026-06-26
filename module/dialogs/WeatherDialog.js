import { FrontOnOpen } from "../utils/front-on-open.js";
import { openOrFocus } from "../utils/open-or-focus.js";
import { getSetting, setSetting } from "../settings.js";
import { WEATHER_SEASONS, getWeatherSeason, rollWeather, rowRange } from "../utils/weather.js";

const SEASON_SETTING = "weatherSeason";

// ── WeatherDialog ────────────────────────────────────────────────────────────
// A compact GM tool for the expedition weather roll (Book I, p.325): pick the
// season, roll 1d6 on its table, post a result card. The season tables and roll
// live in utils/weather.js; this is just the picker. Opened from the sun-cloud
// hotbar macro (see hooks/Ready.js). Remembers the last season per client.

export class WeatherDialog extends Application {
	constructor(options = {}) {
		super(options);
		// Restore the last-used season, defaulting to the first table.
		const saved = getSetting(SEASON_SETTING);
		this._season    = getWeatherSeason(saved) ? saved : WEATHER_SEASONS[0].key;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static open() {
		return openOrFocus("stonetop-weather", () => new WeatherDialog().render(true));
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-weather",
			title:     "Weather",
			template:  "systems/stonetop/templates/dialogs/weather.hbs",
			width:     420,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-weather-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();
		html.find(".stonetop-weather-season").on("click", ev => this._pickSeason(ev.currentTarget.dataset.season));
		html.find(".stonetop-weather-roll-btn").on("click", () => this._roll2());
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		const season = getWeatherSeason(this._season);
		return {
			seasons: WEATHER_SEASONS.map(s => ({ key: s.key, label: s.label, isActive: s.key === this._season })),
			label:   season.label,
			rows:    season.rows.map(r => ({
				range:  rowRange(r),
				text:   r.text,
				reroll: !!r.reroll,
			})),
		};
	}

	// Switch season and remember it for next time.
	async _pickSeason(key) {
		if (!getWeatherSeason(key) || key === this._season) return;
		this._season = key;
		await setSetting(SEASON_SETTING, key);
		this.render(false);
	}

	// Roll 1d6 on the current season's table; the result posts to chat, so just
	// close the picker rather than echoing the roll back into the dialog.
	async _roll2() {
		await rollWeather(this._season);
		this.close();
	}
}
