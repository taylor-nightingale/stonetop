export class FakeDOMElement {
	dataset = {};
	className = "";
	name = "";
}

export class FakeDOMContainer {
	#elements = new Set();
	contains(el) { return this.#elements.has(el); }
	add(el) { this.#elements.add(el); return this; }
}
