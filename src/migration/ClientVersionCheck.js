/**
 * Answers whether the browser is running the code the server has installed.
 *
 * Foundry serves a system's esmodules as plain <script type="module"> tags carrying no version in the
 * URL, so a browser may keep the previous release's JavaScript in its HTTP cache indefinitely.
 * Templates are never cached — getTemplate pulls them over the socket, straight off the server's disk —
 * so an updated world hands a stale client fresh templates that include partials the code it is running
 * never registered. Those sheets then fail to open, and restarting the server changes nothing, because
 * the stale half lives in the browser.
 */
export class ClientVersionCheck {
	constructor(loadedVersion, installedVersion) {
		this._loadedVersion    = loadedVersion;
		this._installedVersion = installedVersion;
	}

	/** True when the cached code and the installed system disagree, in either direction. */
	get isStale() {
		// A world that reports no version at all cannot answer the question either way, and crying stale
		// would lock every user out of a world that is probably fine.
		if (!this._installedVersion) return false;
		return this._loadedVersion !== this._installedVersion;
	}
}
