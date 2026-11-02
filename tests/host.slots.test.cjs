/**
 * dsh-dream-skin — HOST REGIONS WE WATCH BUT DO NOT PAINT (issue #90).
 *
 * 0.2.1-alpha.1 added `renderSlot("shell.bottom", {})` into a `data-shell-bottom`
 * element painted with `var(--dsw-alias-bg-base)` — our canvas wash token. It is
 * a real risk (a full-width strip that could let content read through) AND a
 * real measurement (nothing registers the slot; an empty slot in an `auto` grid
 * row collapses).
 *
 * This file exists so that "nothing to paint" is a DECISION with an expiry
 * date rather than a sentence somebody wrote once. Three rules, each of which
 * can fail:
 *
 *   - the region must be measured by the census, not remembered;
 *   - an `unmounted` disposition is only valid while the measured registrant
 *     count is 0 — the moment the corpus moves, the gate reddens;
 *   - the excuse is dated (`since`), and a `since` that is not newer than the
 *     census host is not an excuse, it is an error.
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { HOST_SLOTS, SLOT_DISPOSITIONS, checkSlots } = require("../scripts/lib/host-slots.cjs");
const { findHostRoot, listFiles } = require("../scripts/host-consumers.cjs");

const ROOT = path.join(__dirname, "..");
const CENSUS = path.join(ROOT, "scripts", "data", "host-token-census.json");

const census = () => JSON.parse(fs.readFileSync(CENSUS, "utf8"));
const readReal = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const live = (overrides = {}) => {
	const c = overrides.census || census();
	return {
		slots: overrides.slots || c.slots,
		story: overrides.story || { files: c.host.filesScanned, packages: c.host.packagesScanned },
		allow: overrides.allow || HOST_SLOTS,
		kinds: overrides.kinds || SLOT_DISPOSITIONS,
		hostVersion: overrides.hostVersion !== undefined ? overrides.hostVersion : c.host.dshVersion
	};
};

// ── the gate ──────────────────────────────────────────────────────────────

test("#90: every watched host region is measured and dispositioned", () => {
	const { problems, counts } = checkSlots(live());
	assert.deepEqual(problems, [], `the watched-region list is out of step with its measurement:\n  ${problems.join("\n  ")}`);
	assert.ok(counts.watched >= 1, 'a watch list that measures nothing satisfies every rule below vacuously');
	// Re-taken 2026-11-02 against dsh 0.2.1-rc.5: `shell.bottom` gained a registrant, so
	// "unmounted" is no longer the word that fits and the old identity
	// (`unmounted === watched`) quietly became "every region is still unmounted" — a claim
	// about our vocabulary, not about the host. What must hold instead: every watched region
	// carries one of the three kinds, and the kinds partition the watch list.
	assert.equal(counts.unmounted + counts.outOfScope, counts.watched,
		'every watched region must carry a kind the gate knows, and no region may be tallied twice');
	assert.equal(counts.live, counts.watched, 'on this host every watched region now has at least one registrant file — a claim that expired must not be re-stated as a fact');
});

test("#90: the bottom region is a recorded fact, not an assumption", () => {
	const c = census();
	const row = c.slots && c.slots.entries["shell.bottom"];
	assert.ok(row, 'the census must record the shell bottom region');
	// Measured on dsh 0.2.1-rc.5 (re-taken 2026-11-02). Three files carry the string and they
	// are NOT three of the same thing — the disposition spells out which is which: the layout
	// package renders the slot, the runner's hit is its slots CONTRACT CATALOG, and the one
	// real registrant is the experimental inspector's docked DevTools panel. The old `0` was
	// the fact that made `unmounted` true; when it moved, the claim had to come back.
	assert.equal(row.registrants, 3, 'the frozen corpus must state how many files touch shell.bottom — if this moved, the disposition is taken again');
	assert.equal(row.anchorFiles, 1, 'the `data-shell-bottom` anchor now exists on the measured host (it did not on 0.2.0-rc.1) — recorded, not assumed');
	assert.ok(c.slots.ruler && c.slots.ruler.length > 100, 'the slot ruler must explain what "registrant" means here');
	const { findings } = checkSlots(live());
	assert.ok(
		findings.some((f) => f.startsWith("shell.bottom")),
		`"we looked and decided not to paint this" must be VISIBLE in the gate's output, got: ${JSON.stringify(findings)}`
	);
	// The visible finding must carry the measurement, or it is a label wearing a fact.
	const finding = findings.find((f) => f.startsWith("shell.bottom"));
	assert.ok(finding.includes(`${row.registrants} registrant file(s)`), `the finding must state the measured count, got: ${finding}`);
	// And the region must be dated: the excuse has to expire.
	assert.match(HOST_SLOTS["shell.bottom"].since, /^\d+\.\d+\.\d+/, 'the region needs the host version that introduced it');
});

test("#90: the boundary is published, with the measurements that justify it", () => {
	// The decision lives in an internal data file; the user-visible boundary
	// has to live in the user-visible document. Both halves, or the "known
	// limitation" section is a promise nobody can check.
	const doc = readReal("docs/desktop-support.md");
	for (const token of ["data-shell-bottom", "pI_x6G_bottomRow", "minmax(0, 1fr) auto", "shell.bottom"]) {
		assert.ok(doc.includes(token), `docs/desktop-support.md must record the bottom-region evidence (\`${token}\`)`);
	}
	// The count next to the region is DERIVED from the census, not copied: the sentence in the
	// document has to carry whatever number the measurement says. Located by ROW SHAPE, not by
	// "the first mention anywhere" — the first `shell.bottom` in this document sits in the
	// release-history chain, and a window opened there would pass or fail on unrelated prose.
	const measured = String(census().slots.entries["shell.bottom"].registrants);
	const row = doc.split('\n').find((l) => l.startsWith('| alpha.1 底栏区域 `shell.bottom`'));
	assert.ok(row, 'docs/desktop-support.md must carry the bottom-region boundary row');
	assert.ok(new RegExp(measured + '\\s*(个|files|个文件|）|\\))').test(row),
		`the boundary row must state the measured registrant count (${measured}) next to the region, not just name it`);
	// The anchor count moved with it, so the row has to carry that measurement too.
	const anchors = String(census().slots.entries["shell.bottom"].anchorFiles);
	assert.ok(row.includes(`锚点命中 ${anchors} 个文件`), `the boundary row must state the anchor measurement (${anchors} file(s)) as measured`);
});

// ── the live half ─────────────────────────────────────────────────────────

test("#90: with the host installed, the watched-region counts still match the frozen census", (t) => {
	let root;
	try {
		root = findHostRoot();
	} catch (e) {
		t.skip(`host not installed — the watched regions were NOT re-measured here (${e.message.split("\n")[0]})`);
		return;
	}
	const files = listFiles(root, [".css", ".js", ".mjs", ".cjs"]);
	const cached = new Map();
	const readFile = (f) => {
		if (!cached.has(f)) cached.set(f, fs.readFileSync(f, "utf8"));
		return cached.get(f);
	};
	const fresh = {};
	for (const [name, spec] of Object.entries(HOST_SLOTS)) {
		let registrants = 0;
		let anchorFiles = 0;
		for (const file of files) {
			const text = readFile(file);
			if (text.includes(name)) registrants += 1;
			if (spec.anchor && text.includes(spec.anchor)) anchorFiles += 1;
		}
		fresh[name] = { registrants, anchorFiles };
	}
	const frozen = census().slots.entries;
	for (const [name, row] of Object.entries(fresh)) {
		assert.equal(row.registrants, frozen[name].registrants, `${name}: registrant count moved — re-run \`npm run host:census\` and re-take the decision`);
		assert.equal(row.anchorFiles, frozen[name].anchorFiles, `${name}: anchor presence moved — re-run \`npm run host:census\``);
	}
});

// ── mutations: issue #90 asked for a gate that can fail ───────────────────

test("mutation #90.1: re-stating the expired claim, or denying the face, reddens the gate", () => {
	// The whole point of the disposition: a claim about a face must follow the measurement.
	// Two directions, both real, both derived from the fact that moved this round.
	const c = census();
	// ① Back to `unmounted` while the corpus says files register it — the exact claim 11.2.0
	//    shipped with, which the re-take invalidated.
	const revived = checkSlots(live({ allow: { "shell.bottom": { ...HOST_SLOTS["shell.bottom"], disposition: "unmounted" } } }));
	assert.ok(
		revived.problems.some((p) => p.startsWith("shell.bottom") && p.includes("the face is live")),
		`a live face must invalidate an "unmounted" claim, got: ${JSON.stringify(revived.problems)}`
	);
	// ② The other direction: keep `out-of-scope` but take the registrants away — a decision
	//    about a face that is not there is stale policy, not a decision.
	const gone = JSON.parse(JSON.stringify(c));
	gone.slots.entries["shell.bottom"] = { registrants: 0, anchorFiles: 0, mentions: [] };
	const vanished = checkSlots(live({ census: gone }));
	assert.ok(
		vanished.problems.some((p) => p.includes("describes a face that is not there")),
		`a non-unmounted claim with no registrant must be reported, got: ${JSON.stringify(vanished.problems)}`
	);
});

test("mutation #90.2: a corpus we cannot read, or an empty watch list, reddens the gate", () => {
	const { problems } = checkSlots(live({ story: { files: 0, packages: 0 } }));
	assert.ok(problems.some((p) => p.includes("corpus is empty")), 'a corpus we cannot read must not look like "nothing registers it"');
	const { problems: none } = checkSlots(live({ slots: { ruler: "x", entries: {} } }));
	assert.ok(none.some((p) => p.includes("no slot was measured")), 'an empty watch list must be a problem, not a pass');
});

test("mutation #90.3: an undispositioned region, an invented kind, and a stale entry all redden", () => {
	const c = census();
	const undispositioned = checkSlots(live({ allow: {} }));
	assert.ok(undispositioned.problems.some((p) => p.includes("nobody has decided")), 'an undecided region must be named');
	const typo = checkSlots(live({ allow: { "shell.bottom": { ...HOST_SLOTS["shell.bottom"], disposition: "ignored" } } }));
	assert.ok(typo.problems.some((p) => p.includes("unknown disposition")), 'a non-vocabulary word is a typo, not a policy');
	// A region nobody measured cannot carry a disposition.
	const stale = checkSlots(live({ slots: { ruler: c.slots.ruler, entries: {} } }));
	assert.ok(stale.problems.some((p) => p.includes("not measured by the census")), 'a disposition for an unmeasured region must be reported');
	// …and neither can a region with no stable anchor.
	const noAnchor = checkSlots(live({ allow: { "shell.bottom": { ...HOST_SLOTS["shell.bottom"], anchor: "" } } }));
	assert.ok(noAnchor.problems.some((p) => p.includes("stable `anchor`")), 'the anchor is what a future rule would use; it must be named');
});

test("mutation #90.4: a `since` used as an excuse on a host that already has the region reddens", () => {
	// Forward-dating ("it arrives in a version newer than the one we measured") is legitimate.
	// Back-dating is not: a region that should exist on the measured host and measures 0
	// registrants is an extraction bug, not a fact. The rule only speaks when the face is
	// empty, so the leg constructs that world instead of relying on the live one — and the
	// live one is asserted separately below, because on 2026-11-02 the excuse ran out.
	const c = census();
	const empty = JSON.parse(JSON.stringify(c));
	empty.slots.entries["shell.bottom"] = { registrants: 0, anchorFiles: 1, mentions: [] };
	const { problems } = checkSlots(live({ census: empty, hostVersion: "0.3.0" }));
	assert.ok(
		problems.some((p) => p.startsWith("shell.bottom") && p.includes("must not be excused by a future version")),
		`a stale \`since\` must be reported, got: ${JSON.stringify(problems)}`
	);
	// The control that makes the rule above meaningful rather than decorative: on the host we
	// actually measured, the region is older than the host AND occupied — which is precisely
	// why `unmounted` stopped being an answer.
	assert.ok(HOST_SLOTS["shell.bottom"].since <= c.host.dshVersion, `the region predates the measured host (${c.host.dshVersion}), so "not yet" cannot carry it`);
	assert.ok(c.slots.entries["shell.bottom"].registrants > 0, 'and it is occupied on that host');
});

test("mutation #90.5: a disposition on a face that is not there reddens the gate", () => {
	// `skinned` means "we paint this region". Claiming it about a region with 0 registrants is
	// a rule written against nothing — the exact failure mode this repository deletes rather
	// than documents. Synthesised, because the live region now does have a registrant.
	const c = census();
	const empty = JSON.parse(JSON.stringify(c));
	empty.slots.entries["shell.bottom"] = { registrants: 0, anchorFiles: 1, mentions: [] };
	const { problems } = checkSlots(live({ census: empty, allow: { "shell.bottom": { ...HOST_SLOTS["shell.bottom"], disposition: "skinned" } } }));
	assert.ok(
		problems.some((p) => p.includes("describes a face that is not there")),
		`a disposition describing an absent face must be reported, got: ${JSON.stringify(problems)}`
	);
});

module.exports = { checkSlots, HOST_SLOTS };
