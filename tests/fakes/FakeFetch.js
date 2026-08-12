// A stand-in for global fetch: queue the responses a test expects, then inspect what was sent.
// Responses are real Response objects, so consumers get genuine ok/status/headers/json behaviour.

export class FakeFetchCall {
	constructor(url, init = {}) {
		this.url = url;
		this.method = init.method;
		this.headers = init.headers ?? {};
		this.body = init.body;
	}

	json() {
		return JSON.parse(this.body);
	}

	header(name) {
		const key = Object.keys(this.headers).find((k) => k.toLowerCase() === name.toLowerCase());
		return key === undefined ? undefined : this.headers[key];
	}
}

export class FakeFetch {
	#responses = [];

	constructor() {
		this.calls = [];
	}

	respondWith(response) {
		this.#responses.push(response);
		return this;
	}

	respondJson(body, { status = 200, headers = {} } = {}) {
		return this.respondWith(new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json", ...headers },
		}));
	}

	respondText(text, { status = 200, headers = {} } = {}) {
		return this.respondWith(new Response(text, { status, headers: { "content-type": "text/html", ...headers } }));
	}

	respondStatus(status) {
		return this.respondText("", { status });
	}

	get handler() {
		return async (url, init) => {
			this.calls.push(new FakeFetchCall(url, init));
			if (!this.#responses.length) throw new Error(`FakeFetch: unexpected request to ${url}`);
			return this.#responses.shift();
		};
	}

	get lastCall() {
		return this.calls.at(-1);
	}
}
