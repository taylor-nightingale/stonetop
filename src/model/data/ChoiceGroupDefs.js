import { FollowerLink } from "./FollowerLink.js";

/**
 * Structural discovery of choice groups. A choice group is any object carrying a string `slug` and an
 * array `list`, wherever it sits in an item's data — `front.unlock`, `back.consequences`,
 * `backgrounds[].choices`, and so on. Finding them by shape rather than by a hand-maintained list of
 * paths means a group added anywhere (including on a custom item authored in Foundry) is picked up
 * with no new code, which is what stops "the collector and the renderer disagree" bugs.
 *
 * This answers "what exists here?" — never "where should it render?". Layout stays declared by the
 * host template, because position is design information that isn't present in the data.
 */
export class ChoiceGroupDef {
	constructor(path, slug, def) {
		this.path = path;   // "front.unlock", "backgrounds.2.choices"
		this.slug = slug;
		this.def  = def;
	}

	get rows() { return this.def.list ?? []; }

	/** The follower links carried by this group's rows. */
	followerLinks() {
		return this.rows.map(r => FollowerLink.fromRaw(r.followers)).filter(Boolean);
	}

	/** Followers granted outright: a follower row with NO track (no checkbox to gain it). A row WITH a
	 *  track is choice-gated — added/removed when its box is checked — so it grants nothing here. */
	ownedFollowerGrants() {
		return this.rows
			.filter(r => !r.track)
			.flatMap(r => FollowerLink.fromRaw(r.followers)?.grants() ?? []);
	}
}

export class ChoiceGroupDefs {
	/** Every choice group in a document's data. Works on raw `item.system` or on a domain model
	 *  (Arcanum, Possession) alike — both are plain nested objects. */
	static findAll(data) {
		const found = [];
		const walk = (node, path) => {
			if (!node || typeof node !== "object") return;
			if (!Array.isArray(node) && typeof node.slug === "string" && Array.isArray(node.list)) {
				found.push(new ChoiceGroupDef(path, node.slug, node));
			}
			for (const [key, value] of Object.entries(node)) {
				if (value && typeof value === "object") walk(value, path ? `${path}.${key}` : key);
			}
		};
		walk(data, "");
		return found;
	}

	static findBySlug(data, slug) {
		return this.findAll(data).find(d => d.slug === slug) ?? null;
	}

	/** Every group under one namespace. Arcana deliberately give `front.unlock` and `back.choices` the
	 *  arcanum's own slug — they share one value store — so a namespace can name more than one group. */
	static findAllBySlug(data, slug) {
		return this.findAll(data).filter(d => d.slug === slug);
	}

	static followerLinks(data) {
		return this.findAll(data).flatMap(d => d.followerLinks());
	}

	static ownedFollowerGrants(data) {
		return this.findAll(data).flatMap(d => d.ownedFollowerGrants());
	}
}
