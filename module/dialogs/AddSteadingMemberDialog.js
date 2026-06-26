import { FrontOnOpen } from "../utils/front-on-open.js";
import { OCCUPATIONS, TRAITS, HOMES } from "../data/steading-members.js";
import { StonetopAutocomplete } from "../utils/autocomplete.js";

const HOME_INFO_DIALOG_CLASS = "stonetop-asm-child-dialog";

const STONETOP_NAMES = [
	"Aderyn", "Aeronwen", "Afanen", "Afon", "Alun", "Andras", "Aneirin", "Awstin",
	"Bedwyr", "Berwyn", "Betrys", "Braith", "Briallen", "Bronwen", "Bryn",
	"Cadi", "Cadoc", "Cadwygan", "Caron", "Cefin", "Ceinwen", "Ceridwyn", "Cerys", "Colwyn",
	"Deiniol", "Dilwen", "Dylis",
	"Eifion", "Eirlys", "Eluned", "Emrys", "Enfys", "Eurwen",
	"Gaenor", "Garet", "Gethin", "Glyndir",
	"Heledd", "Hywel",
	"Ifan", "Iorwerth", "Iwan",
	"Lewela", "Leuca", "Linos",
	"Mado", "Maldwyn", "Malon", "Mared", "Marged", "Martyn", "Meirion", "Menwen", "Mererid",
	"Neirin", "Nia",
	"Ofydd", "Olwyn", "Owain",
	"Padrig", "Parry", "Pryce", "Pryder",
	"Rheinal", "Rhisiart", "Rhosyn", "Rydderch",
	"Sawyl", "Siana", "Sioned",
	"Talfryn", "Tegid", "Tiwlip", "Tomos", "Tudyr",
	"Winifred", "Yorath",
];

const MARSHEDGE_NAMES = [
	"Abben", "Ailen", "Brin", "Brogan", "Catlin", "Coln", "Daedre", "Dermos",
	"Ennin", "Finnen", "Gilor", "Isbeal", "Kiran", "Lile", "Lim", "Mathuin",
	"Mirne", "Noren", "Owan", "Ragan", "Renan", "Seadha", "Seann", "Tierney", "Ulliam",
];

const STEPLANDS_NAMES = [
	"Adm", "Blej", "Cirl", "Davth", "Elst", "Gwilm", "Gwenl", "Henri", "Ines",
	"Jenfir", "Jown", "Juda", "Kiln", "Laurl", "Loic", "Merrn", "Maikl", "Nanzl",
	"Nolwn", "Quent", "Reegn", "Ropr", "Sabi", "Stren", "Yanz",
];

const LYGOS_NAMES = [
	"Agatte", "Aref", "Alix", "Baraz", "Canan", "Darya", "Demetra", "Elene",
	"Elios", "Fotios", "Faruza", "Golza", "Iasos", "Iona", "Kyriakos", "Marika",
	"Maayan", "Osher", "Natasa", "Nivola", "Rinat", "Stamat", "Thecla", "Zhaleh",
];

const NEIGHBOR_NAMES_BY_HOME = {
	"Marshedge": MARSHEDGE_NAMES,
	"The Steplands": STEPLANDS_NAMES,
	"Lygos": LYGOS_NAMES,
};

// Per the Steading playbook's "Notable neighbors" reference, name lists are only
// given for Marshedge, the Steplands, and Lygos — everywhere else either has no
// dedicated list ("Other places: Barrier Pass, the Manmarch, etc.") or explicitly
// says to "choose from other lists" (Gordin's Delve, since "everyone comes ...
// from somewhere else"). Those homes fall back to the full combined name pool.
const NEIGHBOR_NAMES = Object.values(NEIGHBOR_NAMES_BY_HOME).flat();

// Short blurbs drawn from the "World's End" setting overview, for the "About
// these places" info button beside the neighbor's Home dropdown.
const HOME_INFO = {
	"Marshedge": "A proper town with a wooden palisade, market, and town council — though the old bandit Brennan and his gang, the Claws, run the watch.",
	"Gordin's Delve": "A rugged mining town in the Huffel Peaks, named for the Maker-made passages that plunge beneath the mountains. Mask-wearing Ustrina sometimes come up from the depths to trade.",
	"The Steplands": "Rugged wilderness roamed by the nomadic Hillfolk — horselords and shepherds, fierce and barbaric to outsiders.",
	"Lygos": "A city far to the south, reached after a long trek through the arid Manmarch. Steady trade flows between Marshedge, Lygos, and the other southern towns.",
	"Barrier Pass": "A mountain stronghold sealed by a massive wall and gate, held by stoic, unfriendly folk who live on goats and sheep and want little to do with strangers.",
	"The Manmarch": "Sparsely settled southern plains, and the feuding, warlike longhouse-dwellers of the north — who'd be a terror to all the world, should they ever unite.",
};

export class AddSteadingMemberDialog extends Application {
	constructor(type, onConfirm, options = {}) {
		super(options);
		this._type = type;
		this._onConfirm = onConfirm;
		this._formData = { name: "", occupation: "", traits: "", relations: "", notes: "" };
		if (type === "neighbor") this._formData.home = "";
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			template: "systems/stonetop/templates/dialogs/add-steading-member.hbs",
			width: 460,
			height: "auto",
			resizable: true,
			classes: ["stonetop", "stonetop-add-member-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	get title() {
		return this._type === "neighbor" ? "Add Neighbor" : "Add Resident";
	}

	getData() {
		return {
			isNeighbor: this._type === "neighbor",
			names: this._namesForHome(this._formData.home),
			occupations: OCCUPATIONS,
			traits: TRAITS,
			homes: HOMES,
		};
	}

	/** Names available depend on which "Home" is selected — see the Steading playbook's "Notable neighbors" reference. */
	_namesForHome(home) {
		if (this._type !== "neighbor") return STONETOP_NAMES;
		return NEIGHBOR_NAMES_BY_HOME[home] ?? NEIGHBOR_NAMES;
	}

	_showHomeInfo() {
		const entries = HOMES.map(home => `
			<div class="stonetop-asm-home-info-entry">
				<h3>${home}</h3>
				<p>${HOME_INFO[home] ?? ""}</p>
			</div>`).join("");
		new Dialog({
			title: "Notable Places",
			content: `<div class="stonetop-asm-home-info">${entries}</div>`,
			buttons: { close: { label: "Close" } },
			default: "close",
		}, { width: 480, classes: ["dialog", "stonetop-asm-home-info-dialog", HOME_INFO_DIALOG_CLASS] }).render(true);
	}

	/**
	 * The name field is a free-type combo box, so we only refresh its suggestion
	 * list when the Home changes — whatever the user has typed is left untouched.
	 */
	_refreshNameOptions(root) {
		const list = root.querySelector("#asm-list-name");
		if (!list) return;
		const names = this._namesForHome(this._formData.home);
		// _namesForHome returns a stable array reference per resolved home, so the
		// suggestion set only actually changes when the typed value resolves to a
		// different known home. Skip the option-node teardown/rebuild otherwise —
		// the listener fires on every keystroke, but most keystrokes stay on the
		// same (default) pool.
		if (names === this._lastNameOptions) return;
		this._lastNameOptions = names;
		list.replaceChildren(...names.map(n => {
			const o = document.createElement("option");
			o.value = n;
			return o;
		}));
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();
		const root = html[0];

		// Replace the combo fields' native <datalist> popups with our scrollable one —
		// Chromium's native popup has no scrollbar for long lists. The <datalist>s stay
		// as the (live-refreshed) option source; see utils/autocomplete.js.
		StonetopAutocomplete.upgradeAll(html);
		// Track the suggestion set the template already rendered, so the first home
		// keystroke that stays on the same pool doesn't trigger a needless rebuild.
		this._lastNameOptions = this._namesForHome(this._formData.home);

		// Every field is a free-type input now (combos are inputs backed by a
		// <datalist>), so listen on "input" to capture typing live as well as picks.
		root.querySelectorAll(".asm-input").forEach(el => {
			el.addEventListener("input", () => {
				this._formData[el.name] = el.value;
			});
		});

		// The pool of suggested names depends on which "Home" is selected (see the
		// Steading playbook's "Notable neighbors" reference) — refilter when it changes.
		root.querySelector('.asm-combo[name="home"]')?.addEventListener("input", () => {
			this._refreshNameOptions(root);
		});

		root.querySelector(".asm-info[data-info='home']")?.addEventListener("click", () => this._showHomeInfo());

		root.querySelectorAll(".asm-randomize").forEach(btn => {
			btn.addEventListener("click", () => {
				const input = root.querySelector(`.asm-combo[name="${btn.dataset.target}"]`);
				if (!input) return;
				// The `list` attribute is gone (upgradeAll suppresses the native popup),
				// so read the suggestions straight off the still-present <datalist>.
				const datalist = root.querySelector(`#asm-list-${btn.dataset.target}`);
				const options = datalist
					? Array.from(datalist.options).map(o => o.value).filter(Boolean)
					: [];
				if (!options.length) return;
				input.value = options[Math.floor(Math.random() * options.length)];
				input.dispatchEvent(new Event("input"));
			});
		});

		root.querySelector(".asm-confirm")?.addEventListener("click", () => {
			if (!this._formData.name.trim()) {
				ui.notifications?.warn("Name is required.");
				return;
			}
			this._onConfirm({ ...this._formData });
			this.close();
		});

		root.querySelector(".asm-cancel")?.addEventListener("click", () => this.close());
	}
}
