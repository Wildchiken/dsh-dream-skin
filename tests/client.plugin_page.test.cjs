/**
 * dsh-dream-skin — the host's plugin-manager page (issue #130).
 *
 * Measured against the official @deepseek-ai/dsh-client-ui-plugin-manager@0.2.1-rc.5
 * bundle: the surfaces that paint are hashed classes reading
 * `background: var(--dsw-alias-bg-layer-N)` (guide=layer-1; registry and
 * registryToggle=layer-2; registryCustomField, attemptBadge, approvalList code and
 * the [type=text] inputs=layer-3), while the `data-plugin-*` anchors carry no
 * background at all. So the page is fixed by overriding the three TOKENS on the two
 * roots that own those surfaces — the page root and the portaled registry — letting
 * only the alpha follow the wallpaper slider (PAGE_FILL_VAR) and keeping each skin's
 * own hue.
 *
 * The 10.30.1 attempt instead painted four `data-plugin-*` anchors with the popup
 * glass recipe: it covered containers that should stay clear, missed every surface a
 * reader was looking at, and borrowed 弹窗透明度. Both halves of that mistake are
 * pinned here, in both directions.
 *
 * Boundary: this is a source-level contract for CSS we could not eyeball in a live
 * 0.2.1-rc.5 host (this machine runs 0.2.0-rc.1). It proves the rules are present and
 * gated, not that the page looks right.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'lib', 'client.js'), 'utf8');

/** The two roots that own the painted surfaces: the page and the portaled registry. */
const PAGE_ROOTS = ['[data-plugin-panel]', '[data-install-registry]'];
/** The three host tokens the page paints with. */
const LAYER_TOKENS = ['--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-layer-3'];

/** A rule block in the generated sheet, keyed by its selector line. */
function ruleBlock(text, selectorLine) {
	const start = text.indexOf(selectorLine);
	if (start < 0) return null;
	const end = text.indexOf('"}",', start);
	return end > start ? text.slice(start, end) : null;
}

const CAPTURE_SELECTOR = '"html[" + WASH_ACTIVE_ATTR + "] {"';
const TOKENS_SELECTOR = '"html[" + WASH_ACTIVE_ATTR + "] [data-plugin-panel],",';
const ROOT_CLEAR_SELECTOR = '"html[" + WASH_ACTIVE_ATTR + "] [data-plugin-panel] {"';

/** The anchors 10.30.1 painted; they must stay out of the popup glass rule. */
const RETIRED_ANCHORS = [
	'"[data-plugin-group],"',
	'"[data-plugin-item-detail],"',
	'"[data-plugin-detail],"',
	'"[data-plugin-rows],"'
];

function modalGlassBlock(text) {
	const start = text.indexOf('QUESTION_CARD_SELECTOR + ","');
	if (start < 0) return null;
	const end = text.indexOf('// --- Composer (chat input) glass', start);
	return end > start ? text.slice(start, end) : null;
}

function pluginPageProblems(text) {
	const problems = [];

	const capture = ruleBlock(text, CAPTURE_SELECTOR);
	if (capture === null) {
		problems.push('the layer-token capture on html[wash] is gone — without it the page override would be a custom-property cycle');
	} else {
		if (!capture.includes('MODAL_FILL_VAR')) {
			// Non-vacuous: this slice must be the capture block, not any html[wash] rule.
			for (const token of LAYER_TOKENS) {
				const src = `--dsh-dream-skin-layer-src-${token.slice(-1)}`;
				if (!capture.includes(`"  ${src}: var(${token});"`)) {
					problems.push(`capture block does not snapshot ${token} (found: ${capture.slice(0, 80)}…)`);
				}
			}
		} else {
			problems.push('the capture slice is not the capture block (marker missing)');
		}
	}

	const tokens = ruleBlock(text, TOKENS_SELECTOR);
	if (tokens === null) {
		problems.push('the page-root token rule is gone — the plugin page paints opaque again');
	} else {
		for (const token of LAYER_TOKENS) {
			const line = `"  ${token}: color-mix(in srgb, var(--dsh-dream-skin-layer-src-${token.slice(-1)}) var(" + PAGE_FILL_VAR + ", 92%), transparent);"`;
			if (!tokens.includes(line)) problems.push(`${token} no longer washed by PAGE_FILL_VAR on the page roots`);
		}
		if (!tokens.includes(PAGE_ROOTS[1])) {
			problems.push('the portaled registry root lost its override (it inherits nothing from the page root)');
		}
		if (tokens.includes('MODAL_FILL_VAR')) {
			problems.push('the page fill reads the POPUP slider again — issue #130 says a page follows 壁纸透明度');
		}
	}

	const rootClear = ruleBlock(text, ROOT_CLEAR_SELECTOR);
	if (rootClear === null || !rootClear.includes('background-color: transparent !important')) {
		problems.push('the page root is not cleared under a wash (rule missing or no longer gated by WASH_ACTIVE_ATTR)');
	}

	const glass = modalGlassBlock(text);
	if (glass === null) {
		problems.push('modal glass selector block moved — cannot check what the popup rule covers');
	} else {
		if (!glass.includes('PLAN_CARD_SELECTOR')) problems.push('the slice is not the modal-glass rule (marker missing)');
		for (const anchor of RETIRED_ANCHORS) {
			if (glass.includes(anchor)) problems.push(`${anchor} is back in the popup glass rule (layout-only container, painted by mistake)`);
		}
	}

	if (!text.includes('[PAGE_FILL_VAR]: {')) {
		problems.push('PAGE_FILL_VAR is never published on the wallpaper token layer — the page cannot follow the wallpaper slider');
	} else if (!text.includes('`${Math.round(canvasAlpha * 100)}%`')) {
		problems.push('the page weight no longer derives from canvasAlpha — the canvas and the page could drift apart');
	}
	return problems;
}

test('plugin page: the three layer tokens are washed on both roots, driven by the wallpaper weight', () => {
	assert.deepEqual(pluginPageProblems(CODE), [], `\n${pluginPageProblems(CODE).join('\n')}\n`);
});

test('mutation: removing any washed token or either root reddens by name', () => {
	for (const token of LAYER_TOKENS) {
		const line = `"  ${token}: color-mix(in srgb, var(--dsh-dream-skin-layer-src-${token.slice(-1)}) var(" + PAGE_FILL_VAR + ", 92%), transparent);",`;
		assert.ok(CODE.includes(line), `anchor moved for ${token}`);
		const problems = pluginPageProblems(CODE.replace(line, ''));
		assert.ok(problems.some((p) => p.includes(token)), `deleting the ${token} line must name it: ${JSON.stringify(problems)}`);
	}
	const noPortal = CODE.replace('"html[" + WASH_ACTIVE_ATTR + "] [data-install-registry] {",', '"html[" + WASH_ACTIVE_ATTR + "] [data-plugin-panel] {",');
	assert.ok(pluginPageProblems(noPortal).some((p) => p.includes('portaled registry')), 'dropping the registry root must redden');
});

test('mutation: republishing the page from the popup slider reddens', () => {
	const swapped = CODE.replace(
		'"  --dsw-alias-bg-layer-2: color-mix(in srgb, var(--dsh-dream-skin-layer-src-2) var(" + PAGE_FILL_VAR + ", 92%), transparent);"',
		'"  --dsw-alias-bg-layer-2: color-mix(in srgb, var(--dsh-dream-skin-layer-src-2) var(" + MODAL_FILL_VAR + ", 92%), transparent);"'
	);
	assert.notEqual(swapped, CODE, 'the layer-2 line anchor moved');
	assert.ok(pluginPageProblems(swapped).some((p) => p.includes('POPUP slider')), 'borrowing the popup slider must redden');
});

test('mutation: putting the capture on the panel (a property cycle) reddens', () => {
	const moved = CODE.replace(CAPTURE_SELECTOR, '"html[" + WASH_ACTIVE_ATTR + "] [data-plugin-panel] __capture {"');
	assert.notEqual(moved, CODE, 'the capture anchor moved');
	assert.ok(pluginPageProblems(moved).some((p) => p.includes('cycle')), 'a capture that is not on <html> must redden');
});

test('mutation: the retired anchors sneaking back into the popup rule reddens', () => {
	for (const anchor of RETIRED_ANCHORS) {
		const back = CODE.replace('PLAN_CARD_SELECTOR + ",",', `PLAN_CARD_SELECTOR + ",",\n\t\t\t\t${anchor}`);
		assert.notEqual(back, CODE, `cannot re-add ${anchor}`);
		assert.ok(pluginPageProblems(back).some((p) => p.includes(anchor)), `${anchor} back in the glass rule must redden`);
	}
});

test('mutation: an ungated, deleted, or unpublished wash reddens', () => {
	const ungated = CODE.replace(ROOT_CLEAR_SELECTOR, '"[data-plugin-panel] {"');
	assert.notEqual(ungated, CODE, 'the page-root anchor moved');
	assert.ok(pluginPageProblems(ungated).some((p) => p.includes('page root')), 'an ungated root rule must be a problem');

	const unpublished = CODE.replace(/\t\t\t\t\[PAGE_FILL_VAR\]: \{\n(?:.*\n){2}\t\t\t\t\},/, '');
	assert.notEqual(unpublished, CODE, 'the publish entry anchor moved');
	assert.ok(pluginPageProblems(unpublished).some((p) => p.includes('never published')), 'a page weight nobody publishes must redden');

	const hardcoded = CODE.replaceAll('`${Math.round(canvasAlpha * 100)}%`', '"92%"');
	assert.notEqual(hardcoded, CODE, 'the canvasAlpha-derived value anchor moved');
	assert.ok(pluginPageProblems(hardcoded).some((p) => p.includes('drift apart')), 'a hardcoded weight must redden — it would freeze the page while the slider moves');
});
