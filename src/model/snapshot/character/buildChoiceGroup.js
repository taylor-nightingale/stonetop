import { rich } from "../RichText.js";
import { FollowerLink } from "../../data/FollowerLink.js";
import {
	ChoiceGroup, ChoiceOption, ChoiceRow, ChoiceValues, EntryRow, EntryRowFollowers,
} from "./ChoiceGroup.js";

/**
 * Builds the render snapshot for one choice group from its pack data. A pure, dependency-free
 * transformation: pack def + stored values → ChoiceGroup. Every choice group everywhere — arcanum
 * unlock/back-choices/consequences, playbook, insert, background, possession, steading, a follower's
 * own choices — goes through this ONE function, so there is no per-caller divergence.
 *
 * It does NOT resolve followers. A row that carries a FollowerLink gets an EntryRowFollowers REFERENCE
 * (the requested slugs + inlineDisplay, no card data); the sheet resolves each slug against the character's
 * normalized `followers.bySlug` registry at render. That keeps this function synchronous and free of any
 * data dependency, which is what let the old stateful factory collapse to a function.
 */
export function buildChoiceGroup(entry, values = new ChoiceValues()) {
	const es = entry.slug;
	const list = (entry.list ?? []).map((item, idx) => buildRow(item, values, es, idx));
	return new ChoiceGroup(es, list);
}

// Picks carry an explicit type in pack data but are identified only by an `options` array in character
// groupDefs — route both to the pick builder.
function buildRow(item, values, es, idx) {
	return (item.type === "pick" || Array.isArray(item.options))
		? buildPickRow(item, es, idx, values)
		: buildEntryRow(item, values, es);
}

function buildEntryRow(item, values, es) {
	let track = null;
	if (item.track && item.slug) {
		const count  = values.getCount(es, item.slug);
		const checks = Array.from({ length: item.track.max ?? 1 }, (_, i) => i < count);
		track = { slug: item.slug, checks, requires: item.track.requires ?? null };
	}
	const input = item.input
		? {
			slug:        `${item.slug}-input`,
			placeholder: item.input.placeholder ?? null,
			value:       values.getText(es, `${item.slug}-input`) || (item.input.default ?? ""),
			type:        item.input.type ?? "inline",
		}
		: null;
	const c = item.content ?? {};
	const content = {
		title:        rich(c.title),
		titleNote:    rich(c.titleNote),
		subtitle:     rich(c.subtitle),
		subtitleNote: rich(c.subtitleNote),
		text:         rich(c.text),
	};

	// A pure reference — the template resolves each slug against `followers.bySlug` at render.
	const link      = FollowerLink.fromRaw(item.followers);
	const followers = link ? new EntryRowFollowers(link.slugs, link.inlineDisplay) : null;

	return new EntryRow(
		item.slug ?? null,
		content,
		track,
		input,
		followers,
		item.outfitItems ?? [],
		item.indent ?? false,
	);
}

function buildPickRow(item, es, idx, values) {
	const radio           = (item.pickCount ?? 1) === 1;
	const rowKey          = `${es}-row-${idx}`;
	const siblingSlugsCsv = radio ? (item.options ?? []).map(o => o.slug).join(",") : null;
	return new ChoiceRow(
		(item.options ?? []).map(o => new ChoiceOption(o.slug, {
			text:        rich(o.content?.title ?? o.text ?? null),
			description: rich(o.content?.text ?? o.description ?? null),
			checked:     values.getCount(es, o.slug) > 0,
			type:        o.type ?? null,
			fillValue:   o.type === "input" ? values.getText(es, o.slug + "-fill") : "",
		})),
		{ inline: item.inline ?? false, rowKey, radio, siblingSlugsCsv },
	);
}
