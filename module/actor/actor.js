export function createStonetopActorClass(BaseActor) {
	return class StonetopActor extends BaseActor {
		prepareData() {
			super.prepareData();
			const hp = this.system?.attributes?.hp;
			if (hp) hp.value = Math.clamp(hp.value, 0, hp.max);
		}

		// -- EVENT HANDLERS ----------------------------------------
		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (collection !== "items") return;
			const playbook = documents.find(d => d.type === "playbook");
			if (!playbook) return;
			const hp = playbook.flags?.stonetop?.hp;
			const damage = playbook.flags?.stonetop?.damage;
			if (!hp || !damage) return;
			await this.update({
				"system.attributes.hp.max": hp,
				"system.attributes.hp.value": hp,
				"system.attributes.damage.value": damage,
			});
		}
	};
}
