import { hasText } from "../RichText.js";

/**
 * The one instinct a character has, and where it is edited (D7). An insert's instinct replaces the
 * playbook's once one is picked, so the latest insert carrying one wins; otherwise it is the
 * playbook's pick or write-in. The masthead shows it and routes to the tab that edits it.
 */
export class InstinctReadout {
	constructor(label, source, tab, sectionKey = "instinct") {
		this.label        = label ?? "";
		this.source       = source ?? "";
		this.tab          = tab ?? "";
		// The section that edits it — where the masthead's route lands and what it opens.
		this.sectionKey   = sectionKey;
		// An insert's is in force, and the playbook's is set aside rather than gone (D12).
		this.isFromInsert = tab !== "playbook";
		this.isEmpty      = !hasText(this.label);
	}

	/**
	 * @param {PlaybookSnapshot|null} playbook
	 * @param {InsertSnapshot[]} inserts in the order they were gained
	 */
	static from(playbook, inserts) {
		const carrier = inserts.findLast(insert => hasText(insert.instinctSelected));
		if (carrier) return new InstinctReadout(carrier.instinctSelected, carrier.name, `insert-${carrier.slug}`,
			`insert-${carrier.slug}-instinct`);
		return new InstinctReadout(playbook?.instinctSelected, playbook?.title, "playbook");
	}
}
