import { HostWindow } from "./HostWindow.js";

/** Foundry's DialogV2 confirm/prompt/wait, opened in the window the player is working in. */
export class HostedDialog {
	constructor({
		dialogs = () => foundry.applications.api.DialogV2,
		host    = new HostWindow(),
	} = {}) {
		this._dialogs = dialogs;
		this._host    = host;
	}

	confirm(config) {
		return this._dialogs().confirm(this._hosted(config));
	}

	prompt(config) {
		return this._dialogs().prompt(this._hosted(config));
	}

	wait(config) {
		return this._dialogs().wait(this._hosted(config));
	}

	_hosted(config) {
		return { ...config, renderOptions: { ...this._host.renderOptions(), ...config.renderOptions } };
	}
}
