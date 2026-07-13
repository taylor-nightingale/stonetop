// The "Install Book Artwork" screen (Settings → Configure Settings → Stonetop).
// The GM picks their own book PDF(s); extraction runs right in the browser and
// the recognized illustrations are uploaded to Data/stonetop-art/ — no CLI, no
// filesystem access, works on hosted servers.
import { createArtInstaller, isArtInstalled } from "./foundryArt.js";
import { getSetting, setSetting } from "../settings.js";

// Class factory, deferred to init like the sheet classes: the ApplicationV2 base
// isn't available at module-evaluation time.
export function createArtInstallerAppClass() {
	const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

	return class ArtInstallerApp extends HandlebarsApplicationMixin(ApplicationV2) {
		static DEFAULT_OPTIONS = {
			id: "stonetop-art-installer",
			classes: ["stonetop", "stonetop-art-installer"],
			window: { title: "stonetop.artInstaller.title", icon: "fas fa-images" },
			position: { width: 540 },
			actions: {
				install: function () { return this._install(); },
				dismissNudge: function () { return this._dismissNudge(); },
			},
		};

		static PARTS = {
			body: { template: "systems/stonetop/templates/apps/art-installer.hbs" },
		};

		_working = false;
		_report = null;
		_error = null;

		async _prepareContext() {
			return {
				working: this._working,
				error: this._error,
				report: this._report && {
					complete: this._report.complete,
					installedCount: this._report.installed.length,
					missingCount: this._report.missing.length,
				},
				alreadyInstalled: !this._report && !this._working && (await isArtInstalled()),
				nudgeDismissed: getSetting("artNudgeDismissed"),
			};
		}

		async _install() {
			const files = [...(this.element.querySelector("input[type=file]")?.files ?? [])];
			if (!files.length) {
				ui.notifications.warn(game.i18n.localize("stonetop.artInstaller.noFiles"));
				return;
			}
			this._working = true;
			this._report = null;
			this._error = null;
			await this.render();
			try {
				const pdfs = [];
				for (const file of files) pdfs.push(new Uint8Array(await file.arrayBuffer()));
				const installer = await createArtInstaller();
				this._report = await installer.install(pdfs, { onProgress: (p) => this._showProgress(p) });
			} catch (e) {
				console.error("stonetop | artwork install failed", e);
				this._error = e.message;
			}
			this._working = false;
			await this.render();
		}

		/** Progress ticks update the DOM directly — a re-render per page would flicker. */
		_showProgress({ file, files, page, pages, found }) {
			const bar = this.element.querySelector("progress");
			if (bar) { bar.max = files * pages; bar.value = (file - 1) * pages + page; }
			const status = this.element.querySelector(".art-progress-status");
			if (status) {
				status.textContent = game.i18n.format("stonetop.artInstaller.progress", { file, files, page, pages, found });
			}
		}

		async _dismissNudge() {
			await setSetting("artNudgeDismissed", true);
			await this.render();
		}
	};
}
