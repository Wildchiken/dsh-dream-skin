/**
 * dsh-dream-skin — the README's reference counts must match the code.
 *
 * PR #131's follow-up list found three drifted claims in README: the number of
 * `settings.dreamSkin.item` rows (said 5, actually 7), the compositor pane list
 * (six panes, but the enumeration named only five), and a fill-mode label that
 * only drift on that branch. This gate pins the two that were true on main:
 *
 *   - the row count is derived from the bundle, not typed here;
 *   - the compositor pane count is derived from `scripts/compositor-audit.cjs`,
 *     and the sentence must also name the sixth surface and the declaration
 *     count (6 panes + 2 `none` low-power guards = 8 declarations).
 *
 * The seven translations are checked by their own number word; a count change
 * that updates only the Chinese README reddens here.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { auditSource } = require('../scripts/compositor-audit.cjs');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const CODE = read('lib/client.js');

const I18N = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'ru'];
const ROW_WORDS = {
	de: ['fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'],
	en: ['five', 'six', 'seven', 'eight', 'nine', 'ten'],
	es: ['cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'],
	fr: ['cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
	ja: ['5', '6', '7', '8', '9', '10'],
	ko: ['다섯', '여섯', '일곱', '여덟', '아홉', '열'],
	ru: ['пять', 'шесть', 'семь', 'восемь', 'девять', 'десять']
};

function rowCount(text) {
	return (text.match(/ctx\.slots\.inject\("settings\.dreamSkin\.item"/g) || []).length;
}

/** The sentence that names the slot is the last mention in the architecture section. */
function sentenceAroundSlot(text) {
	const i = text.lastIndexOf('settings.dreamSkin.item');
	return i < 0 ? '' : text.slice(Math.max(0, i - 300), i + 80);
}

function rowProblems(readFile, count) {
	const problems = [];
	// Address the sentence by its phrase, not by the last mention of the slot:
	// the README's version notes also name `settings.dreamSkin.item`.
	for (const rel of ['README.md', 'docs/PROJECT.md']) {
		const phrase = `${count} 个功能行`;
		const i = readFile(rel).indexOf(phrase);
		if (i < 0) {
			problems.push(`${rel}: no "${phrase}"`);
			continue;
		}
		const window = readFile(rel).slice(Math.max(0, i - 120), i + phrase.length + 200);
		if (!window.includes('settings.dreamSkin.item')) problems.push(`${rel}: "${phrase}" is not next to settings.dreamSkin.item`);
	}
	if (count - 5 < 0 || count - 5 >= 6) {
		problems.push(`row count ${count} is outside the word table (5..10) — extend it deliberately`);
		return problems;
	}
	for (const lang of I18N) {
		const rel = `docs/i18n/README.${lang}.md`;
		const word = ROW_WORDS[lang][count - 5];
		if (!sentenceAroundSlot(readFile(rel)).includes(word)) {
			problems.push(`${rel}: the row sentence does not state "${word}" (${count})`);
		}
	}
	return problems;
}

function compositorNumbers() {
	const audit = auditSource(CODE, 'lib/client.js');
	const standard = audit.backdropFilters.filter((d) => d.property === 'backdrop-filter' && !d.webkit);
	const blurPanes = standard.filter((d) => typeof d.value === 'string' && d.value.includes('blur(') && !d.value.includes('none')).length;
	return { blurPanes, declarations: audit.counts.backdropFilterDeclarations };
}

function compositorSection(text) {
	const start = text.indexOf('## 🔬 合成器预算');
	if (start < 0) return '';
	const end = text.indexOf('\n## ', start + 1);
	return text.slice(start, end < 0 ? text.length : end);
}

function compositorProblems(text, numbers) {
	const problems = [];
	const section = compositorSection(text);
	if (!section) return ['README.md: the compositor-budget section moved'];
	if (!section.includes(`${numbers.blurPanes} 块 \`backdrop-filter\` 面板`)) {
		problems.push(`README.md: the section does not state ${numbers.blurPanes} 块 backdrop-filter 面板`);
	}
	if (!section.includes(`${numbers.declarations} 条声明`)) {
		problems.push(`README.md: the section does not state ${numbers.declarations} 条声明 (panes + none guards)`);
	}
	if (!section.includes('命令面板')) {
		problems.push('README.md: the pane list no longer names the `/` command menu (the sixth pane)');
	}
	return problems;
}

test('reference counts: the README row count and compositor pane list match the code', () => {
	const count = rowCount(CODE);
	assert.equal(count, 7, `the bundle registers ${count} settings rows — the word table assumes 5..10`);
	const numbers = compositorNumbers();
	assert.ok(numbers.blurPanes > 0, 'the audit found no blur-bearing panes — the parser broke');
	assert.ok(numbers.declarations > numbers.blurPanes, 'the declaration count must include the none guards');
	assert.deepEqual(rowProblems(read, count), []);
	assert.deepEqual(compositorProblems(read('README.md'), numbers), []);
});

test('mutation: a stale row count in README or PROJECT reddens by name', () => {
	const count = rowCount(CODE);
	for (const rel of ['README.md', 'docs/PROJECT.md']) {
		const stale = read(rel).replace(`${count} 个功能行`, `${count - 2} 个功能行`);
		const problems = rowProblems((r) => (r === rel ? stale : read(r)), count);
		assert.ok(problems.some((p) => p.startsWith(rel)), `a stale count in ${rel} must be named`);
	}
});

test('mutation: a wrong pane count, a missing command menu, or a wrong declaration count reddens', () => {
	const numbers = compositorNumbers();
	const readme = read('README.md');
	const wrongPanes = readme.replace(`${numbers.blurPanes} 块`, `${numbers.blurPanes - 1} 块`);
	assert.notEqual(wrongPanes, readme, 'the pane count anchor moved');
	assert.ok(compositorProblems(wrongPanes, numbers).some((p) => p.includes('块')), 'a wrong pane count must be named');

	const noMenu = readme.replace('命令面板', '');
	assert.notEqual(noMenu, readme, 'the command-menu anchor moved');
	assert.ok(compositorProblems(noMenu, numbers).some((p) => p.includes('command menu')), 'a missing sixth pane must be named');

	const wrongDecl = readme.replace(`${numbers.declarations} 条声明`, `${numbers.declarations - 2} 条声明`);
	assert.notEqual(wrongDecl, readme, 'the declaration-count anchor moved');
	assert.ok(compositorProblems(wrongDecl, numbers).some((p) => p.includes('条声明')), 'a wrong declaration count must be named');
});

// ── the settings nav label, per language ──────────────────────────────────
//
// Since 11.3.0 the host nav entry is resolved from the plugin's own dictionaries
// (`label: () => sectionNavLabel()`), because the host renders slot labels verbatim.
// That makes each README's "open Settings → X" a claim about one specific string in the
// bundle — and this round already drifted that text twice by hand, so it is derived here
// rather than copied.

/** The eight `settings.nav` values, in dictionary order (zh, en, ja, ko, es, fr, de, ru). */
const navLabels = () => [...CODE.matchAll(/^\t\t\t"settings\.nav": "(.*)",$/gmi)].map((m) => m[1]);
const NAV_ORDER = ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru'];

/** The check as a pure function, so a mutation case can feed it a broken document. */
function navLabelProblems(values, readDoc) {
	const problems = [];
	const docFor = (lang) => (lang === 'zh' ? 'README.md' : `docs/i18n/README.${lang}.md`);
	for (let i = 0; i < NAV_ORDER.length; i += 1) {
		const doc = readDoc(docFor(NAV_ORDER[i]));
		if (!doc.includes(values[i])) {
			problems.push(`${docFor(NAV_ORDER[i])} does not name the section the way its own language renders it ("${values[i]}")`);
		}
	}
	// The Chinese nav text must not be left behind in a document that speaks another language.
	for (const lang of I18N) {
		if (readDoc(`docs/i18n/README.${lang}.md`).includes('个性化皮肤')) {
			problems.push(`docs/i18n/README.${lang}.md still points at the Chinese nav entry`);
		}
	}
	return problems;
}

test('reference counts: every README names the nav entry its own language will see', () => {
	const values = navLabels();
	assert.equal(values.length, 8, 'the bundle must carry settings.nav in all eight dictionaries');
	assert.equal(new Set(values).size, 8, 'eight distinct nav strings, one per language');
	assert.deepEqual(navLabelProblems(values, read), [], `the nav wording drifted:\n  ${navLabelProblems(values, read).join('\n  ')}`);
});

test("mutation: a README left on another language's nav text reddens by name", () => {
	const values = navLabels();
	const enPath = 'docs/i18n/README.en.md';
	const drifted = read(enPath).split(values[1]).join('个性化皮肤');
	assert.notEqual(drifted, read(enPath), 'the mutation has to change the document');
	const swapped = new Map([[enPath, drifted]]);
	const problems = navLabelProblems(values, (rel) => (swapped.has(rel) ? swapped.get(rel) : read(rel)));
	assert.ok(problems.some((line) => line.includes('README.en.md')),
		`the gate must name the drifted document, got: ${JSON.stringify(problems)}`);
	// Control: the same helper over the real tree is silent, so the red above is the drift
	// and not a check that cannot pass.
	assert.deepEqual(navLabelProblems(values, read), [], 'control: the unmutated tree must pass');
});

/**
 * The 「能力 / What you can do」 table, read as the SEQUENCE of its row emojis.
 *
 * WHY. Two drifts this round were both invisible to every existing gate: the Chinese
 * README advertised 低功耗模式 while none of the seven translations did (a row that
 * shipped in one language only), and the new 恢复出厂设置 row went into the Chinese
 * table first and had to be chased into the other seven by hand. The count gates here
 * watch section names and pane lists; nobody watched the feature list itself. A reader
 * who picks the German README should not get a strictly smaller picture of the plugin.
 */
function capabilityRows(text) {
	return text.split('\n').filter((l) => /^\| \p{So}/u.test(l)).map((l) => ({
		// The row's identity: the emoji that opens it.
		mark: l.match(/^\| (\p{So}+)/u)[1],
		// Its shape: how many cells (the leading and trailing pipes do not count).
		cells: l.split('|').length - 2,
		// Its TECHNICAL vocabulary: backticked tokens are file names, API layers and
		// storage keys. They translate to themselves, so eight documents must carry the
		// same set — and this is the part of the row a wrong value hides in (external
		// blue-team B6: the emoji ledger could not see one). Numbers are NOT ledgered:
		// word order and local number formatting legitimately differ ("92 %" / "92%"),
		// so a digits ledger would demand re-translation, not tell the truth.
		codes: (l.match(/`[^`]+`/g) || []).slice().sort().join(' ')
	}));
}

const DOC_PATHS = ['README.md'].concat(I18N.map((lang) => `docs/i18n/README.${lang}.md`));

function capabilityProblems(readDoc) {
	const zh = capabilityRows(readDoc('README.md'));
	assert.ok(zh.length >= 18, `the Chinese capability table should have at least 18 rows, found ${zh.length} — a collapsed table is not parity`);
	const problems = [];
	for (const rel of DOC_PATHS.slice(1)) {
		const rows = capabilityRows(readDoc(rel));
		if (rows.length !== zh.length) {
			problems.push(`${rel}: ${rows.length} capability rows vs the Chinese README's ${zh.length}`);
			continue;
		}
		for (let i = 0; i < zh.length; i += 1) {
			const want = zh[i];
			const got = rows[i];
			const where = `${rel}: row ${i + 1} (${want.mark})`;
			if (want.mark !== got.mark) problems.push(`${where} is ${got.mark} where the Chinese README has ${want.mark}`);
			if (want.cells !== got.cells) problems.push(`${where} has ${got.cells} cells where the Chinese README has ${want.cells}`);
			if (want.codes !== got.codes) problems.push(`${where} names ${got.codes || '(no code tokens)'} where the Chinese README names ${want.codes}`);
		}
	}
	return problems;
}

test('reference counts: all eight READMEs advertise the same capability table', () => {
	assert.deepEqual(capabilityProblems(read), [],
		`the translations advertise a different feature list from the Chinese README:\n  ${capabilityProblems(read).join('\n  ')}`);
});

test('mutation: drift INSIDE a parity row reddens, not only a row that is missing', () => {
	// Blue-team B6: the ledger used to read nothing but the row-opening emoji, so a cell
	// could promise the opposite of the feature and eight documents stayed green. What is
	// now compared per row is shape (cells) and vocabulary (backticked tokens) — NOT the
	// prose: "keeps your imports" turned into "wipes your imports" still passes, and anyone
	// wanting that checked needs a claim site, not this parity gate.
	const enPath = 'docs/i18n/README.en.md';
	const en = read(enPath);
	// (a) the persistence row stops naming the file it stores into.
	const lostCode = en.replace('**and the host-side `dream-skin.json`**', '**and a host-side file**');
	assert.notEqual(lostCode, en, 'the code-token leg has to change the document');
	const codeProblems = capabilityProblems((rel) => (rel === enPath ? lostCode : read(rel)));
	assert.ok(codeProblems.some((line) => /row \d+ .*names /.test(line)),
		`a row that stops naming the file must be caught by name, got ${JSON.stringify(codeProblems)}`);
	// (b) a row that grows a cell — the table stops being that table.
	const lines = en.split('\n');
	const at = lines.findIndex((l) => l.startsWith('| \u{1F9F9}'));
	assert.ok(at > 0, 'this leg needs the 恢复出厂 row in the English README');
	const grown = [...lines];
	grown[at] = grown[at].replace(/\|\s*$/, '| and it wipes the wallpaper list too |');
	assert.notEqual(grown.join('\n'), en, 'the cell leg has to change the document');
	const cellProblems = capabilityProblems((rel) => (rel === enPath ? grown.join('\n') : read(rel)));
	assert.ok(cellProblems.some((line) => /cells where/.test(line)),
		`an extra cell must be caught by count, got ${JSON.stringify(cellProblems)}`);
	assert.deepEqual(capabilityProblems(read), [], 'control: the unmutated tree must pass');
});

test('mutation: a capability row shipped in one language only reddens by name', () => {
	const enPath = 'docs/i18n/README.en.md';
	const withoutRow = read(enPath).split('\n').filter((l) => !/^\| \p{So} \*\*Restore factory settings/u.test(l)).join('\n');
	assert.notEqual(withoutRow, read(enPath), 'the mutation has to remove a row');
	const problems = capabilityProblems((rel) => (rel === enPath ? withoutRow : read(rel)));
	assert.ok(problems.some((line) => line.includes('README.en.md')),
		`the gate must name the short document, got: ${JSON.stringify(problems)}`);
	// Two rows swapped is a different failure than a missing one, and must also be caught.
	const lines = read(enPath).split('\n');
	const LOW_POWER = '\u{1FAAB}';
	const atLowPower = lines.findIndex((l) => l.startsWith(`| ${LOW_POWER} `));
	assert.ok(atLowPower > 0, 'the swap leg relies on the low-power row having a row above it');
	const swapped = [...lines];
	const tmp = swapped[atLowPower];
	swapped[atLowPower] = swapped[atLowPower - 1];
	swapped[atLowPower - 1] = tmp;
	const swappedDoc = swapped.join('\n');
	const swapProblems = capabilityProblems((rel) => (rel === enPath ? swappedDoc : read(rel)));
	assert.ok(swapProblems.some((line) => /row \d+ \(.*\) is /.test(line)),
		`a re-ordered table must be named by row, got: ${JSON.stringify(swapProblems)}`);
	assert.deepEqual(capabilityProblems(read), [], 'control: the unmutated tree must pass');
});
