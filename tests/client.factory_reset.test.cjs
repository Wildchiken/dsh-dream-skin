/**
 * 恢复出厂设置 (11.4.0) — the one button on this page that rewrites everything.
 *
 * Two properties matter more here than the happy path:
 *
 *  1. COVERAGE. The reset is four buckets over the keys this plugin owns. A fifth
 *     setting shipped next release that lands in none of them would simply never be
 *     reset, and nothing in the suite would notice. So the owned key list is read OUT
 *     OF THE BUNDLE TEXT and required to be classified exactly once — this gate can
 *     only be satisfied by changing the table, not by editing the assertion.
 *  2. BELONGING. "Factory" must not quietly mean "delete whatever is under our key
 *     prefix". Imported packs, favourites, the wallpaper folder path and the rotation
 *     URL list are user content that happens to live under `dsh-dream-skin:`, and a
 *     real state file on this machine also carries a key NO build of ours ever wrote.
 *     A reset cannot know what that one means, so it must not touch it.
 *
 * Every claim is checked against a live run: the tables are exported as data, the page
 * is booted with every setting dirtied to a VALID non-default value, and the assertions
 * read what the button actually wrote. Both failure shapes are replayed on a mutated
 * bundle (a reset that forgets a row store / a reset that eats the user's packs).
 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildSandbox, makeRequire, makeApplyContext, CODE, releaseAllIntervals } = require('./fixtures/page-sandbox.cjs');

const BUNDLE = path.join(__dirname, '..', 'lib', 'client.js');
const SOURCE = fs.readFileSync(BUNDLE, 'utf8');
const PACKS_ROW = 'dream-skin-packs';

// The host push is debounced 200 ms; anything shorter races it.
const flush = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/**
 * The keys this plugin owns, split by the naming convention this bundle keeps:
 * storage constants end in `_KEY`, the two override-source labels do not. The split
 * is asserted rather than assumed — see `the prefix belongs to state...` below, which
 * names every non-`_KEY` string it found. Without that, a storage key declared
 * without the suffix would fall out of the enumeration and the coverage gate would
 * quietly get weaker instead of louder.
 */
function splitKeys(source) {
	const storage = new Map();
	const other = new Map();
	for (const m of source.matchAll(/const ([A-Z0-9_]+) = "(dsh-dream-skin:[^"]+)"/g)) {
		(m[1].endsWith('_KEY') ? storage : other).set(m[2], m[1]);
	}
	return { storage, other };
}

function ownedKeys(source) {
	return splitKeys(source).storage;
}

/**
 * The third ledger (11.4.0, third-party T2). `splitKeys` reads DECLARATIONS, so a setting
 * written with an INLINE literal — `writeStorage("dsh-dream-skin:cursor-glow", …)` with no
 * constant behind it — is owned by the plugin, invisible to both declaration ledgers, and
 * never reset: the coverage gate would stay green on a feature it cannot see. This scans
 * every quoted key literal and requires each one to have a declaration.
 */
function inlineKeyLiterals(source) {
	const declared = new Set([...source.matchAll(/const [A-Z0-9_]+ = "(dsh-dream-skin:[^"]+)"/g)].map((m) => m[1]));
	const used = new Set([...source.matchAll(/"(dsh-dream-skin:[a-z0-9-]+)"/g)].map((m) => m[1]));
	return [...used].filter((key) => !declared.has(key));
}

function tablesOf(e) {
	return {
		FACTORY_DEFAULTS: e.FACTORY_DEFAULTS,
		FACTORY_RESET_ABSENT: e.FACTORY_RESET_ABSENT,
		FACTORY_RESET_PARTIAL: e.FACTORY_RESET_PARTIAL,
		FACTORY_RESET_KEEP: e.FACTORY_RESET_KEEP
	};
}

/** Boot a page just to read the module's own data out of it. */
function exportsOf(code) {
	return buildSandbox(code ? { code, seed: {} } : { seed: {} }).factory(makeRequire());
}

/**
 * The classification this feature promises, checked two ways: nothing owned is
 * unclaimed, nothing claimed is unowned, nothing is in two buckets, and a "keep"
 * without a readable reason is not a keep.
 */
function bucketProblems(tables, keys) {
	// A Map iterates its ENTRIES, which is how a `for (const key of keys)` quietly
	// becomes `for (const [key, name] of keys)`. Normalise first, then the loop below
	// can mean one thing.
	const list = keys instanceof Map ? [...keys.keys()] : keys;
	const known = new Set(list);
	const buckets = {
		written: new Set(Object.keys(tables.FACTORY_DEFAULTS)),
		absent: new Set(tables.FACTORY_RESET_ABSENT),
		partial: new Set(tables.FACTORY_RESET_PARTIAL),
		kept: new Set(Object.keys(tables.FACTORY_RESET_KEEP))
	};
	const problems = [];
	for (const key of list) {
		const mine = Object.entries(buckets).filter(([, set]) => set.has(key)).map(([name]) => name);
		if (mine.length === 0) problems.push(`${key}: owned by the plugin, claimed by no reset bucket`);
		else if (mine.length > 1) problems.push(`${key}: in ${mine.length} buckets (${mine.join(' / ')}) — it cannot both go back and stay`);
		if (buckets.kept.has(key) && String(tables.FACTORY_RESET_KEEP[key] || '').length < 60) {
			problems.push(`${key}: kept, with a reason nobody could audit`);
		}
	}
	for (const [name, set] of Object.entries(buckets)) {
		for (const key of set) if (!known.has(key)) problems.push(`${key}: claimed by bucket ${name}, but the bundle declares no such key`);
	}
	return problems;
}

/**
 * A page that has been used. Every value is legal and different from the shipped
 * one, so "it went back to factory" cannot be confused with "the engine rejected
 * what I seeded and fell back".
 */
const DIRTY = {
	'dsh-dream-skin:skin': 'abyss',
	'dsh-dream-skin:wallpaper': 'https://example.org/mine.png',
	'dsh-dream-skin:wallpaper-kind': 'gradient',
	'dsh-dream-skin:wallpaper-url': 'https://example.org/daily.png',
	'dsh-dream-skin:wallpaper-gradient': 'linear-gradient(#ff0000, #0000ff)',
	'dsh-dream-skin:wallpaper-opacity': '0.9',
	'dsh-dream-skin:wallpaper-blur': '12',
	'dsh-dream-skin:sidebar-opacity': '0.77',
	'dsh-dream-skin:sidebar-link': '0',
	'dsh-dream-skin:wallpaper-autodim': '0',
	'dsh-dream-skin:wallpaper-follows-skin': '1',
	'dsh-dream-skin:wallpaper-fit': 'contain',
	'dsh-dream-skin:composer-opacity': '0.11',
	'dsh-dream-skin:modal-opacity': '0.5',
	'dsh-dream-skin:material-preset': 'liquid',
	'dsh-dream-skin:wallpaper-refresh': '{"on":1,"hours":6}',
	'dsh-dream-skin:accent': '#123456',
	'dsh-dream-skin:wallpaper-pos-x': '33',
	'dsh-dream-skin:wallpaper-pos-y': '-22',
	'dsh-dream-skin:wallpaper-zoom': '150',
	'dsh-dream-skin:performance': '1',
	'dsh-dream-skin:builtin-last': 'light',
	'dsh-dream-skin:wallpaper-rotation': JSON.stringify({
		on: 1, mode: 'random', minutes: 7, urls: ['https://a/one.png', 'https://a/two.png'],
		lastRotatedAt: 1234567890, source: 'folder'
	}),
	'dsh-dream-skin:packs': '[{"id":"dream-pack:mine"}]',
	'dsh-dream-skin:favorites': '["dream-pack:mine"]',
	'dsh-dream-skin:wallpaper-history': '[{"kind":"url","value":"https://mine/keep.png"}]',
	'dsh-dream-skin:wallpaper-folder': 'C:/Users/me/Pictures/wallpapers',
	// Not ours. The maintainer's real state file carries exactly this shape of stranger.
	'dsh-dream-skin:material-memory': 'do-not-touch-me',
	'some-other-plugin:state': 'do-not-touch-me-either'
};

function dirtySeed(tables) {
	const seed = {};
	// Every key the shipped-look bucket claims MUST have a dirty value here, or the
	// behaviour case below would be asserting about a key it never dirtied.
	for (const key of Object.keys(tables.FACTORY_DEFAULTS)) {
		if (DIRTY[key] === undefined) throw new Error('the dirty table has no value for ' + key + ' — add one, do not skip it');
		seed[key] = DIRTY[key];
	}
	for (const key of tables.FACTORY_RESET_ABSENT) seed[key] = DIRTY[key];
	for (const key of tables.FACTORY_RESET_PARTIAL) seed[key] = DIRTY[key];
	for (const key of Object.keys(tables.FACTORY_RESET_KEEP)) {
		if (DIRTY[key] !== undefined) seed[key] = DIRTY[key];
	}
	seed['dsh-dream-skin:material-memory'] = DIRTY['dsh-dream-skin:material-memory'];
	seed['some-other-plugin:state'] = DIRTY['some-other-plugin:state'];
	return seed;
}

/** Boot a dirty page, run apply, and hand back the page plus the row's actions. */
async function bootDirty({ code = null, hostState = null, hostAnswer = null, without = [], settle = true } = {}) {
	const h = buildSandbox({ seed: {}, code: code || undefined });
	const entry = h.factory(makeRequire());
	const t = tablesOf(entry);
	// Rebuild with the dirty seed now that the tables are known (they are module data,
	// so this reads them off the same bundle the behaviour below runs on).
	const seed = dirtySeed(t);
	// Keys to withhold locally: the desktop shell's fresh origin, where the ONLY copy of
	// the rotation list is the one still sitting in `$DSH_HOME/dream-skin.json`.
	for (const key of without) {
		if (!(key in seed)) throw new Error('withholding a key the dirty table never carried: ' + key);
		delete seed[key];
	}
	const h2 = buildSandbox({ seed, code: code || undefined, hostState, hostAnswer });
	const entry2 = h2.factory(makeRequire());
	const ctx = makeApplyContext(h2);
	entry2.apply(ctx);
	if (settle) await flush();
	return { h: h2, entry: entry2, ctx, tables: t };
}

after(() => releaseAllIntervals());

// ── 1. coverage ───────────────────────────────────────────────────────────

test('the reset table claims every key this plugin owns, exactly once', () => {
	const tables = tablesOf(exportsOf());
	assert.ok(tables.FACTORY_DEFAULTS && tables.FACTORY_RESET_KEEP && tables.FACTORY_RESET_ABSENT && tables.FACTORY_RESET_PARTIAL,
		'the bundle hands the four buckets to the gate as DATA — a gate that re-types them proves nothing about them');
	const keys = ownedKeys(SOURCE);
	assert.ok(keys.size >= 24, `the enumeration has to see the whole namespace, got ${keys.size}`);
	assert.deepEqual(bucketProblems(tables, keys), [], `\n${problemsText(bucketProblems(tables, keys))}\n`);
	// …and the enumeration sees every key the bundle actually uses, not only the ones it
	// declares (third-party T2): an inline literal is a key this gate would never learn about.
	assert.deepEqual(inlineKeyLiterals(SOURCE), [],
		'a storage key written as an inline literal has no constant, so no ledger claims it — declare it');
	// Non-trivial in all four directions, or "covered" would be vacuous.
	assert.ok(Object.keys(tables.FACTORY_DEFAULTS).length >= 14, 'the shipped-look bucket is the big one');
	assert.ok(tables.FACTORY_RESET_ABSENT.length >= 5, 'absent-means-default keys exist (framing, accent, low-power)');
	assert.equal(tables.FACTORY_RESET_PARTIAL.length, 1, 'exactly one key is reset field by field');
	assert.ok(Object.keys(tables.FACTORY_RESET_KEEP).length >= 6, 'the content and bookkeeping keys are named, not implied');
});

function problemsText(list) {
	return list.join('\n') || '(none)';
}

test('mutation: an unclaimed new setting reddens the coverage gate by name', () => {
	const tables = tablesOf(exportsOf());
	const keys = ownedKeys(SOURCE);
	assert.deepEqual(bucketProblems(tables, keys), [], 'control: the live tree is classified');
	// The shape of the bug: a setting ships (so it IS an owned key) and no bucket claims it.
	const grown = new Map(keys);
	grown.set('dsh-dream-skin:cursor-glow', 'CURSOR_GLOW_KEY');
	assert.match(bucketProblems(tables, grown).join('\n'),
		/dsh-dream-skin:cursor-glow.*claimed by no reset bucket/,
		'a setting the reset does not know about has to be named, not counted as covered');
	// The other shape: a bucket that names a key nobody declares is a silent no-op.
	const typo = tablesOf(exportsOf());
	typo.FACTORY_RESET_ABSENT = [...typo.FACTORY_RESET_ABSENT, 'dsh-dream-skin:typoed-key'];
	assert.match(bucketProblems(typo, keys).join('\n'), /typoed-key.*the bundle declares no such key/);
	// And the greedy shape: content claimed twice, once to keep and once to clear.
	const both = tablesOf(exportsOf());
	both.FACTORY_RESET_ABSENT = [...both.FACTORY_RESET_ABSENT, 'dsh-dream-skin:packs'];
	assert.match(bucketProblems(both, keys).join('\n'), /dsh-dream-skin:packs.*cannot both go back and stay/);
});

test('mutation: a key written as an inline literal is named instead of skipped', () => {
	// Text-level on purpose: the ledger scans the bundle, so the injected statement does not
	// have to run for the gate to owe a finding — and the shipped tree has to stay clean for
	// the same reason it is asserted above, not because nothing was injected.
	const anchor = '\t\tfunction resetSettingsToFactory(ctx) {';
	assert.equal(countOf(SOURCE, anchor), 1, 'the anchor this leg patches: ' + JSON.stringify(anchor));
	const grown = SOURCE.replace(anchor, anchor + '\n\t\t\twriteStorage("dsh-dream-skin:cursor-glow", "1");');
	assert.deepEqual(inlineKeyLiterals(SOURCE), [], 'control: the shipped bundle declares every key it quotes');
	const keys = ownedKeys(grown);
	assert.ok(!keys.has('dsh-dream-skin:cursor-glow'), 'the declaration ledger really does miss it — that is the hole');
	assert.deepEqual(inlineKeyLiterals(grown), ['dsh-dream-skin:cursor-glow'], 'and this ledger names it');
});

test('mutation: a keep entry whose reason rotted into a word reddens', () => {
	const tables = tablesOf(exportsOf());
	assert.deepEqual(bucketProblems(tables, ownedKeys(SOURCE)), [], 'control');
	tables.FACTORY_RESET_KEEP = { ...tables.FACTORY_RESET_KEEP, 'dsh-dream-skin:favorites': 'user data' };
	assert.match(bucketProblems(tables, ownedKeys(SOURCE)).join('\n'), /favorites.*reason nobody could audit/);
});

// ── 2. behaviour ──────────────────────────────────────────────────────────

test('a factory reset puts every setting back', async () => {
	const { h, ctx, tables } = await bootDirty();
	const before = {};
	for (const key of Object.keys(tables.FACTORY_DEFAULTS)) before[key] = h.getItem(key);
	for (const key of Object.keys(tables.FACTORY_DEFAULTS)) {
		assert.notEqual(before[key], tables.FACTORY_DEFAULTS[key], `control: ${key} starts off-factory, otherwise "it went back" is not a finding`);
	}
	ctx.actionBags[PACKS_ROW].resetFactory();
	for (const key of Object.keys(tables.FACTORY_DEFAULTS)) {
		assert.equal(h.getItem(key), tables.FACTORY_DEFAULTS[key], `${key} is back on its shipped value`);
	}
	for (const key of tables.FACTORY_RESET_ABSENT) {
		assert.ok(h.getItem(key) === undefined, `${key} goes away — absent IS the default, and a leftover "1" would pin it forever`);
	}
});

test('a factory reset leaves the user content where it is', async () => {
	const { h, ctx, tables } = await bootDirty();
	// The content bucket is exactly the list the gate calls "kept" and the fixture could dirty.
	const content = ['dsh-dream-skin:packs', 'dsh-dream-skin:favorites', 'dsh-dream-skin:wallpaper-history', 'dsh-dream-skin:wallpaper-folder'];
	for (const key of content) assert.ok(Object.keys(tables.FACTORY_RESET_KEEP).includes(key), `${key} must be a named keep, not an accident of the loop`);
	ctx.actionBags[PACKS_ROW].resetFactory();
	for (const key of content) {
		assert.equal(h.getItem(key), DIRTY[key], `${key} survives a factory reset — it is the user's, not a default`);
	}
});

test('the rotation switches go back and the rotation list does not', async () => {
	const { h, ctx, tables } = await bootDirty();
	const key = tables.FACTORY_RESET_PARTIAL[0];
	ctx.actionBags[PACKS_ROW].resetFactory();
	const after = JSON.parse(h.getItem(key));
	assert.deepEqual(after.urls, ['https://a/one.png', 'https://a/two.png'], 'the list the user typed is not a setting');
	assert.equal(after.on, 0, 'the on/off goes back');
	assert.equal(after.mode, 'sequential', 'the order goes back');
	assert.equal(after.minutes, 60, 'the interval goes back to the shipped one');
	assert.equal(after.source, 'links', 'the source goes back');
	assert.equal(after.lastRotatedAt, 0, 'and the phase stamp is dropped with it');
});

test('a key that wears our prefix but is not ours is left alone', async () => {
	const { h, ctx } = await bootDirty();
	ctx.actionBags[PACKS_ROW].resetFactory();
	assert.equal(h.getItem('dsh-dream-skin:material-memory'), 'do-not-touch-me',
		'the real state file on this machine holds a key no build of ours ever wrote; resetting what we cannot read is not ours to do');
	assert.equal(h.getItem('some-other-plugin:state'), 'do-not-touch-me-either', 'and another plugin is even further away');
});

test('the reset repaints through the boot path, and re-syncs every row store', async () => {
	const { h, ctx } = await bootDirty();
	const seen = [];
	const realSetTheme = ctx.theme.setTheme;
	ctx.theme.setTheme = (id) => { seen.push(id); return realSetTheme.call(ctx.theme, id); };
	// Revisions first: the point of the re-sync is that each row is TOLD, and the only
	// observable "was it told" in a store whose guard is `revision <= d.revision` is the
	// revision moving. (What value it moves TO depends on the fake host's theme, which is
	// not the claim this case makes — the accent row's is, because that one reads storage.)
	const before = {};
	for (const [id, state] of Object.entries(ctx.storeStates)) before[id] = state.revision;
	ctx.actionBags[PACKS_ROW].resetFactory();
	for (const [id, state] of Object.entries(ctx.storeStates)) {
		assert.ok(state.revision > before[id], `row ${id} was re-synced after the reset (revision ${before[id]} → ${state.revision})`);
	}
	assert.deepEqual(seen, ['nebula'], 'the factory skin is applied THROUGH the theme service — the same call a boot makes, not a private re-apply');
	assert.equal(ctx.storeStates['dream-skin-accent'].accent, 'system', 'the accent row falls back to the shipped answer, read out of storage');
	const notices = h.window.__DSH_DREAM_SKIN_NOTICES__ || [];
	assert.ok(notices.length > 0, 'the reset announces itself — the page must not change under the user in silence');
	// This harness binds the translator as identity (`bind() => (k) => k`), so what is
	// observable is WHICH message went out, not its wording; the wording is the i18n
	// gate's business, and the skin id is asserted through the theme call above.
	assert.ok(notices.some((n) => /packs\.resetDone/.test(n)), `the confirmation is the reset's own line: ${JSON.stringify(notices)}`);
});

const ROTATION_KEY = 'dsh-dream-skin:wallpaper-rotation';
/** A three-URL list as it would sit in `$DSH_HOME/dream-skin.json` — one entry longer
 *  than the local copy anywhere in this file, so "which list survived" is never ambiguous. */
const HOST_ROTATION = { on: 1, mode: 'random', minutes: 7, urls: ['https://a/one.png', 'https://a/two.png', 'https://a/three.png'], lastRotatedAt: 1234, source: 'links' };

test('a reset pressed before the host answers is not undone by the answer', async () => {
	// The desktop shell answers from `$DSH_HOME/dream-skin.json` a beat after boot, and on
	// a dynamic-port launch that beat is long. Someone who presses 恢复出厂 immediately
	// must not have the pre-reset durable map land on top of their own action — the rule
	// that makes the factory SEED lose to the host (issue #51) must not be read as "the
	// host always wins".
	// The rotation key is staged on the HOST side only (11.4.0, blue-team B2): on the
	// launch this covers, the page has no list of its own, and the list the reset merges
	// onto is the one it has to wait for.
	const stale = {
		'dsh-dream-skin:skin': 'rose',
		'dsh-dream-skin:modal-opacity': '0.9',
		'dsh-dream-skin:accent': '#abcdef',
		[ROTATION_KEY]: JSON.stringify(HOST_ROTATION)
	};
	// Control first: the harness really can deliver that map, so the assertions below are
	// not passing because adoption never happens.
	const untreated = await bootDirty({ hostState: stale, without: [ROTATION_KEY] });
	assert.equal(untreated.h.getItem('dsh-dream-skin:skin'), 'rose',
		'control: an untouched page adopts the durable host map — this fixture does stage the race');
	assert.equal(untreated.h.getItem('dsh-dream-skin:accent'), '#abcdef', 'and more than one key of it');
	assert.deepEqual(JSON.parse(untreated.h.getItem(ROTATION_KEY)).urls, HOST_ROTATION.urls,
		'and the list this page did not have locally arrives from the file — that is the channel the reset below has to read from');

	const raced = await bootDirty({ hostState: stale, settle: false, without: [ROTATION_KEY] });
	raced.ctx.actionBags[PACKS_ROW].resetFactory();
	await flush();
	assert.equal(raced.h.getItem('dsh-dream-skin:skin'), raced.tables.FACTORY_DEFAULTS['dsh-dream-skin:skin'],
		'the late host map does not resurrect 玫瑰 over a reset the user already pressed');
	assert.equal(raced.h.getItem('dsh-dream-skin:modal-opacity'), raced.tables.FACTORY_DEFAULTS['dsh-dream-skin:modal-opacity'],
		'nor the stale 弹窗不透明度');
	assert.ok(raced.h.getItem('dsh-dream-skin:accent') === undefined,
		'nor an accent the reset removed');
	// And the reset still reaches the file — deferred, because the probe had not settled.
	const pushed = raced.h.sent.sets.reduce((all, patch) => all.concat(Object.keys(patch)), []);
	assert.ok(pushed.includes('dsh-dream-skin:skin'),
		`the pending sync has to flush after settlement, got ${JSON.stringify(raced.h.sent.sets)}`);
	assert.equal(raced.h.getItem('dsh-dream-skin:packs'), DIRTY['dsh-dream-skin:packs'],
		'and the content the host map also carried is still the user\'s');
	// B1, the data-loss half of this race: the one key the reset writes FIELD by field
	// merges onto the list it can read. At the click there was nothing to read, so the
	// segment parked and finished when the answer landed — the list is preserved AND the
	// switches went back, which is the whole promise the button makes in eight languages.
	const after = JSON.parse(raced.h.getItem(ROTATION_KEY));
	assert.deepEqual(after.urls, HOST_ROTATION.urls, 'a reset that never saw the list must not push an empty one over it');
	assert.equal(after.on, 0, 'and the parked segment really landed: the switches are back, not quietly skipped');
	assert.equal(after.minutes, 60, 'the interval with them');
	const rotPush = raced.h.sent.sets
		.filter((p) => Object.prototype.hasOwnProperty.call(p, ROTATION_KEY))
		.map((p) => JSON.parse(p[ROTATION_KEY]));
	assert.equal(rotPush.length, 1, `rotation reaches the file exactly once, got ${rotPush.length}`);
	assert.deepEqual(rotPush[0].urls, HOST_ROTATION.urls, 'and what reaches dream-skin.json is the user list with the switches back');
});

test('a list only the file has is never written over when the host does not answer', async () => {
	// Adjudication T6 killed the obvious fix: the 4 s timeout and the `{ok:false}` exits
	// settle the push gate having adopted NOTHING, so "wait until it settles" would have
	// merged onto an empty read and pushed the wipe through a now-open gate. The safe
	// action is the one that leaves the key alone — not writing is also not pushing.
	for (const hostAnswer of ['unreachable', 'refused']) {
		const page = await bootDirty({ hostAnswer, settle: false, without: [ROTATION_KEY] });
		page.ctx.actionBags[PACKS_ROW].resetFactory();
		await flush();
		assert.ok(page.h.getItem(ROTATION_KEY) === undefined,
			`${hostAnswer}: a reset that could not read the list must not create one — this value is the wipe, written while the gate opens behind it`);
		const touched = page.h.sent.sets.reduce((all, p) => all.concat(Object.keys(p)), []);
		assert.ok(!touched.includes(ROTATION_KEY),
			`${hostAnswer}: nothing about rotation may reach dream-skin.json, got ${JSON.stringify(page.h.sent.sets)}`);
		// The rest of the reset did happen, so this is a named skip and not a dead button.
		assert.equal(page.h.getItem('dsh-dream-skin:skin'), page.tables.FACTORY_DEFAULTS['dsh-dream-skin:skin'],
			`${hostAnswer}: the settings half still lands — the user is not left pressing a button that did nothing`);
	}
});

test('a parked segment lands on the no-answer exits when the page does hold a list', async () => {
	// The stable-origin browser whose GET times out: localStorage is durable, so the list
	// IS in front of the page and the parked write becomes admissible the moment the gate
	// opens — merging onto what is there, not onto an empty read.
	for (const hostAnswer of ['unreachable', 'refused']) {
		const page = await bootDirty({ hostAnswer, settle: false });
		page.ctx.actionBags[PACKS_ROW].resetFactory();
		await flush();
		const after = JSON.parse(page.h.getItem(ROTATION_KEY));
		assert.deepEqual(after.urls, JSON.parse(DIRTY[ROTATION_KEY]).urls, `${hostAnswer}: the stored list survives`);
		assert.equal(after.on, 0, `${hostAnswer}: the parked segment landed, so the switches are back and not owed forever`);
		assert.equal(after.minutes, 60, `${hostAnswer}: the interval with them`);
	}
});

test('mutation: a rotation reset that writes what it cannot see reddens the no-answer case', async () => {
	// Blue-team B1 replayed on the bundle: the shipped shape is "merge only over a value
	// this session actually got", and the defect was the unconditional merge. So this leg
	// removes BOTH guards — leaving either one in place keeps the list safe, which is the
	// point of having two, and a leg that patches one would pass for the wrong reason.
	const anchor = '\t\t\tif (!hostProbeSettled) return false;\n'
		+ '\t\t\tconst stored = readStorage(WALLPAPER_ROTATION_KEY);\n'
		+ '\t\t\tif (stored === null || stored === undefined || stored === "") return false;\n';
	assert.equal(countOf(SOURCE, anchor), 1, 'the anchor this leg patches: ' + JSON.stringify(anchor));
	const blind = SOURCE.replace(anchor, '\t\t\tvoid readStorage(WALLPAPER_ROTATION_KEY);\n');
	assert.notEqual(blind, SOURCE, 'the mutation has to change the bundle');
	const kept = await bootDirty({ hostAnswer: 'unreachable', settle: false, without: [ROTATION_KEY] });
	kept.ctx.actionBags[PACKS_ROW].resetFactory();
	await flush();
	assert.ok(kept.h.getItem(ROTATION_KEY) === undefined, 'control: the shipped bundle leaves the key alone');
	const broken = await bootDirty({ code: blind, hostAnswer: 'unreachable', settle: false, without: [ROTATION_KEY] });
	broken.ctx.actionBags[PACKS_ROW].resetFactory();
	await flush();
	assert.ok(broken.h.getItem(ROTATION_KEY) !== undefined,
		'the blind reset DOES write a rotation value it never read — which is what the case above must be able to see');
	assert.deepEqual(JSON.parse(broken.h.getItem(ROTATION_KEY)).urls, [], 'and what it writes is the empty list');
});

test('mutation: a parked segment nobody pays reddens the late-answer case', async () => {
	// The other half: if the settled exits stop calling the flush, the reset is silently
	// half-done (switches stay on). Both sites have to go, or the adopted path would still
	// pay and this leg would pass for the wrong reason.
	const call = '\t\t\t\tif (flushParkedRotationReset() && typeof refreshNotify === "function") refreshNotify();';
	assert.equal(countOf(SOURCE, call), 2, 'both settled exits pay the parked segment, so this leg patches 2 sites');
	const unpaid = SOURCE.split(call).join('\t\t\t\tvoid flushParkedRotationReset;');
	assert.notEqual(unpaid, SOURCE, 'the mutation has to change the bundle');
	const hostState = { [ROTATION_KEY]: JSON.stringify(HOST_ROTATION) };
	const live = await bootDirty({ hostState, settle: false, without: [ROTATION_KEY] });
	live.ctx.actionBags[PACKS_ROW].resetFactory();
	await flush();
	assert.equal(JSON.parse(live.h.getItem(ROTATION_KEY)).on, 0, 'control: the shipped bundle pays the parked write');
	const broken = await bootDirty({ code: unpaid, hostState, settle: false, without: [ROTATION_KEY] });
	broken.ctx.actionBags[PACKS_ROW].resetFactory();
	await flush();
	const after = JSON.parse(broken.h.getItem(ROTATION_KEY));
	assert.deepEqual(after.urls, HOST_ROTATION.urls, 'the list is still safe — this leg is not about data loss');
	assert.equal(after.on, 1, 'and the switches stayed ON: an unpaid segment is a reset that quietly did half its job');
});

test('one host push carries the whole reset', async () => {
	const { h, ctx } = await bootDirty();
	h.sent.sets.length = 0;
	ctx.actionBags[PACKS_ROW].resetFactory();
	await flush();
	assert.equal(h.sent.sets.length, 1, `the 200 ms debounce has to collapse a 20-key rewrite into one push, got ${h.sent.sets.length}`);
	const patch = h.sent.sets[0];
	assert.ok(Object.keys(patch).includes('dsh-dream-skin:skin'), 'the push carries the rewritten settings');
	assert.ok(!Object.keys(patch).includes('dsh-dream-skin:packs'), 'and does not re-send content it never touched');
});

test('mutation: a reset that forgets a row store leaves the page disagreeing with itself', async () => {
	// `restorePersistedState` repaints the DOCUMENT. A row whose store is fed only by user
	// actions keeps showing the value the reset just undid unless it is re-synced by hand —
	// so take the packs re-sync out and the re-sync assertion must be the one that breaks.
	const anchor = '\t\t\t\t\t\t\tsyncPack();\n\t\t\t\t\t\t\tsyncWallpaper();';
	assert.equal(countOf(SOURCE, anchor), 1, 'the anchor this leg patches: ' + JSON.stringify(anchor));
	const forgot = SOURCE.replace(anchor, '\t\t\t\t\t\t\tsyncWallpaper();');
	assert.notEqual(forgot, SOURCE, 'the mutation has to change the bundle');
	const live = await bootDirty();
	const liveBefore = live.ctx.storeStates[PACKS_ROW].revision;
	live.ctx.actionBags[PACKS_ROW].resetFactory();
	assert.ok(live.ctx.storeStates[PACKS_ROW].revision > liveBefore, 'control: the shipped bundle re-syncs the packs row');
	const broken = await bootDirty({ code: forgot });
	const brokenBefore = broken.ctx.storeStates[PACKS_ROW].revision;
	broken.ctx.actionBags[PACKS_ROW].resetFactory();
	assert.equal(broken.ctx.storeStates[PACKS_ROW].revision, brokenBefore,
		'without the re-sync the packs row stays on its pre-reset revision — the library would go on listing the pack the user is no longer wearing');
	// Every OTHER row still moves, so this is one missing line and not a dead test.
	assert.ok(broken.ctx.storeStates['dream-skin-accent'].revision > 0, 'the other rows are still re-synced on the mutated bundle');
});

test('mutation: a reset that also deletes the imported packs reddens the belonging case', async () => {
	const anchor = '\t\t\tfor (const key of FACTORY_RESET_ABSENT) writeStorage(key, null);';
	assert.equal(countOf(SOURCE, anchor), 1, 'the anchor this leg patches: ' + JSON.stringify(anchor));
	const greedy = SOURCE.replace(anchor, '\t\t\tfor (const key of [...FACTORY_RESET_ABSENT, PACKS_KEY]) writeStorage(key, null);');
	assert.notEqual(greedy, SOURCE, 'the mutation has to change the bundle');
	const kept = (page) => page.h.getItem('dsh-dream-skin:packs');
	const live = await bootDirty();
	live.ctx.actionBags[PACKS_ROW].resetFactory();
	assert.equal(kept(live), DIRTY['dsh-dream-skin:packs'], 'control: the shipped bundle keeps them');
	const broken = await bootDirty({ code: greedy });
	broken.ctx.actionBags[PACKS_ROW].resetFactory();
	assert.ok(kept(broken) === undefined,
		'the greedy reset DOES eat the packs — which is exactly what the content case must be able to see');
});

function countOf(source, needle) {
	let n = 0;
	let i = source.indexOf(needle);
	while (i !== -1) { n += 1; i = source.indexOf(needle, i + needle.length); }
	return n;
}

test('the prefix is state, and only state — the enumeration cannot shrink in silence', () => {
	const { storage, other } = splitKeys(SOURCE);
	const declared = (SOURCE.match(/= "dsh-dream-skin:/g) || []).length;
	assert.equal(storage.size + other.size, declared,
		'every "dsh-dream-skin:" string in the bundle is classified by this scan — a new declaration shape would otherwise shrink the reset gate');
	// The two non-`_KEY` strings under our prefix are override-source labels: they name
	// a token layer handed to the theme service, not persisted state. If a THIRD one
	// appears, this case says so instead of the coverage gate losing a key.
	assert.deepEqual([...other.entries()].sort(), [
		['dsh-dream-skin:appearance', 'COMBINED_OVERRIDE_SOURCE'],
		['dsh-dream-skin:material:liquid-glass', 'MATERIAL_CSS_SOURCE']
	], 'the only non-storage names under our prefix are the two override sources (measured 2026-11-03)');
	assert.ok(storage.size >= 28, `the storage namespace is enumerated in full, got ${storage.size}`);
	void CODE;
});
