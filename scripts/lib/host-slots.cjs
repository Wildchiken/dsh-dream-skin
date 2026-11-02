/**
 * dsh-dream-skin — HOST REGIONS WE WATCH BUT DO NOT PAINT (issue #90).
 *
 * 0.2.1-alpha.1 added a bottom region to the shell: the layout renders
 * `renderSlot("shell.bottom", {})` into a `data-shell-bottom` element whose CSS
 * is `background: var(--dsw-alias-bg-base)` — and `--dsw-alias-bg-base` is the
 * token our wallpaper wash writes into. Two things follow, and they pull in
 * opposite directions:
 *
 *   the RISK — a new, full-width, opaque-by-default strip that inherits our
 *   translucent canvas could let conversation content read through it;
 *
 *   the MEASUREMENT — nothing registers that slot. `renderSlot` with no
 *   registrant renders an empty element, and the frame's second grid row is
 *   `auto`, so an empty one collapses to zero height. There is no surface to
 *   skin yet.
 *
 * This file is where "not yet" is recorded — with the evidence, and with the
 * rule that makes it self-expiring: if the frozen corpus ever grows a
 * registrant, the gate reddens and the decision has to be taken again. An
 * excuse that cannot expire is how "we checked" turns into "we assumed".
 *
 * We do NOT add a rule for this region on spec. The repository's anchor
 * discipline (stable `data-*` first, hashes never) exists because a rule that
 * matches nothing is indistinguishable from a rule that was never needed;
 * adding one now would also be a rule written against a host version nobody
 * here has run.
 */

/** The vocabulary. `unmounted` is the only word that currently fits. */
const SLOT_DISPOSITIONS = ['unmounted', 'skinned', 'out-of-scope'];

const HOST_SLOTS = {
	'shell.bottom': {
		disposition: 'out-of-scope',
		since: '0.2.1-alpha.1',
		// Re-decided on 2026-11-02 against the re-taken census (dsh 0.2.1-rc.5). The prediction
		// written into the `unmounted` claim came true: a registrant appeared, so the old claim
		// expired and this one replaces it. The three corpus hits are three different things, and
		// the distinction is the whole decision:
		//   • dsh-client-ui-layout — renders the slot (`renderSlot("shell.bottom", {})`), as always;
		//   • dsh-cordis-client-runner — its slots CONTRACT CATALOG (a doc string describing the
		//     region, including "empty content reserves no space; the occupant owns its height,
		//     visibility, and controls"), not a registration;
		//   • dsh-experimental-inspector — the only real registrant: it injects the docked DevTools
		//     panel here, behind a shortcut, with the panel store starting at "unopened".
		// Neither shipped profile loads the inspector (web: 11 bundles, desktop: 3, neither list
		// contains it), so in practice the row still collapses. And when it IS open, the occupant
		// paints its own surfaces — this is a tool panel, not frame chrome the skin owns.
		anchor: 'data-shell-bottom',
		hash: 'pI_x6G_bottomRow',
		paint: 'background: var(--dsw-alias-bg-base)',
		why:
			'Registrant exists in 0.2.1-rc.5 (dsh-experimental-inspector injects the DevTools panel here, ' +
			'shortcut-gated, store starts "unopened"; the runner hit is its slots contract catalog and the ' +
			'layout hit is the render call), but no shipped profile loads that package and the host contract ' +
			'says the occupant owns its height and visibility — so the face is out of the skin\'s scope, not ' +
			'unmounted any more. Flips to `skinned` the day the strip is measured painting through our wash ' +
			'with content behind it.'
	}
};

/**
 * The gate. Pure — mirrors `checkGap`/`checkHashLiterals` so the suite can hand
 * it deliberately broken inputs and require a specific complaint.
 */
function checkSlots({ slots, story, allow = HOST_SLOTS, kinds = SLOT_DISPOSITIONS, hostVersion = null } = {}) {
	const problems = [];
	const findings = [];
	const entries = (slots && slots.entries) || {};
	const measured = Object.keys(entries).sort();

	if (story && (!story.files || story.files <= 0)) {
		problems.push('the host corpus is empty: a slot watch with no corpus cannot tell "nothing registers it" from "I could not look"');
	}
	if (measured.length === 0) {
		problems.push('no slot was measured at all — an empty watch list passes every rule below and proves nothing');
	}

	for (const name of measured) {
		const entry = allow[name];
		if (!entry || !entry.disposition) {
			problems.push(`${name}: the host renders this region and nobody has decided whether the skin covers it`);
			continue;
		}
		if (!kinds.includes(entry.disposition)) {
			problems.push(`${name}: unknown disposition "${entry.disposition}" (legal: ${kinds.join(' / ')})`);
			continue;
		}
		if (!entry.why || entry.why.length < 40) problems.push(`${name}: the disposition needs a \`why\` long enough to be checkable`);
		if (!entry.anchor) problems.push(`${name}: needs the stable \`anchor\` it would be addressed by (data-* first, hashes never)`);

		const row = entries[name];
		const registrants = (row && row.registrants) || 0;
		if (entry.disposition === 'unmounted' && registrants > 0) {
			problems.push(
				`${name}: declared "unmounted" but ${registrants} file(s) in the frozen corpus now register or mention it ` +
					`(${(row.mentions || []).slice(0, 3).join(', ')}) — the face is live, so "nothing to paint" has to be decided again`
			);
		}
		if (entry.disposition !== 'unmounted' && registrants === 0) {
			problems.push(`${name}: declared "${entry.disposition}" but nothing in the corpus registers it — the disposition describes a face that is not there`);
		}
		if (!entry.since || !/^\d+\.\d+\.\d+/.test(String(entry.since))) {
			problems.push(`${name}: needs a \`since\` — the host version that introduced it`);
		} else if (hostVersion && !(entry.since > hostVersion) && registrants === 0) {
			problems.push(
				`${name}: says "since ${entry.since}" but the census host is ${hostVersion} — ` +
					'a region that exists on the measured host must not be excused by a future version'
			);
		}
		if (entry.disposition === 'unmounted' && registrants === 0) {
			// Not a problem. A fact the reviewer asked to be able to see.
			findings.push(
				`${name} exists from ${entry.since} (${entry.paint}) and measures ${registrants} registrant(s) on the frozen host — ` +
					'nothing to paint yet; the disposition expires the moment that number moves'
			);
		}
		if (entry.disposition === 'out-of-scope') {
			// The same visibility rule, one branch over: "we looked, we decided not to paint it"
			// has to be as readable in the output as "there is nothing to paint", or a decision
			// quietly becomes the absence of one. Its measurement rides along so a reviewer can
			// check the claim against the census without opening the data file.
			findings.push(
				`${name} measures ${registrants} registrant file(s) on the frozen host (${(row.mentions || []).slice(0, 3).join(', ')}) ` +
					`and is deliberately ${entry.disposition} since ${entry.since} — ${entry.paint}`
			);
		}
	}

	// A disposition for a region the census never measured is stale policy.
	for (const name of Object.keys(allow)) {
		if (!entries[name]) problems.push(`${name}: dispositioned but not measured by the census — re-run \`npm run host:census\``);
	}

	const counts = {
		watched: measured.length,
		unmounted: measured.filter((n) => allow[n] && allow[n].disposition === 'unmounted').length,
		outOfScope: measured.filter((n) => allow[n] && allow[n].disposition === 'out-of-scope').length,
		live: measured.filter((n) => ((entries[n] && entries[n].registrants) || 0) > 0).length
	};
	return { problems, findings, counts };
}

module.exports = { HOST_SLOTS, SLOT_DISPOSITIONS, checkSlots };
