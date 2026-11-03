# 设置页版式规格（as-ships）

**这份文件是什么。** 它是 `lib/client.js` 那一节设置面板**当前实际长成什么样**的规格，2026-11-03 从代码与 `tests/client.settings_ui.test.cjs` / `tests/client.storage.test.cjs` 现场反推而成。它**不是** W1–W9 那几轮重构的设计原稿。

**为什么它此前不存在。** 代码与测试里有五处按名字引用 `settings-theme-ui.md`，两处还引用它的**行号**（"line 58""line 61"），而这份文件在 git 全部历史里一次都没出现过（`git log --all --name-only | grep -c settings-theme-ui` = 0）。也就是说，几条断言把自己钉在了一部不存在的法典上：测试读起来像"版式有出处"，实际出处是一份没被提交的本地草稿。**修正方式有两种：把引用改成"由这些用例钉住的事实"，或者把那份事实写下来。** 选了后者，因为前者只是让幽灵引用变得诚实，仍然没有人能从这里读出下一页应该怎么排。

**引用规矩，从这里开始。** 引用本文请用**章节名**（§1、§3……），不要用行号——行号会随一次无关的排版改动变成假的，而那次改动不会让任何门翻红。

---

**覆盖范围，先说清楚。** 本文规格的是 §1 分区顺序、§2 响应式档、§3–§5 的按钮词汇表与「导入与导出」分区的逐行版式。**背景分区的逐行版式不在本文里**——那一节仍由 `tests/client.storage.test.cjs` 与 `tests/client.settings_ui.test.cjs` 自己的断言当权威。上一轮有两处注释写着「某文档 line 58 / line 61」，那引用的是一份从未提交的草稿；现在它们改成指向真正钉住这件事的那条用例。

## §1 分区与顺序

四个分区，自上而下（zh 名 / 键）：

| 顺序 | 键 | zh 标题 |
|---|---|---|
| 1 | `zone.theme` | 主题与配色 |
| 2 | `glass.title` | **玻璃效果**（八语词典现读：zh「玻璃效果」/ en "Glass effect" / ja「ガラス効果」/ ko「글래스 효과」/ es「Efecto de cristal」）。该分区标题 = 其唯一区块的标题被提为 `<h3>`，一个概念一个词，不设第二份拷贝 |
| 3 | `zone.wallpaper` | 背景与壁纸 |
| 4 | `zone.packs` | 导入与导出 |

钉住它的用例：`the zone order is settings-theme-ui's reading order, top to bottom`（`tests/client.settings_ui.test.cjs`）。标题行的完整阅读顺序（分区标题与区块标题交错）由同文件的 `TITLE_ORDER` 常量钉住；W8 删掉了背景分区的两个区块标题、W9 删掉了主题包库自己的标题——**所以现在背景分区与导入分区各自只打印一枚标题**。

## §2 响应式档：宽度从哪来，谁重排

- 触发：`matchMedia("(max-width: 680px)")` → compact 档（`COMPACT_LAYOUT_QUERY`）。681px 及以上仍是 wide 档。
- 内容列宽是**宿主给的**，公式 `min(559, vw - 289)`，实测读数：**559 / 392 / 311 / 131** 四档（131 来自报告过的最窄面板，W4 之前在那里被裁过）。
- compact 档重排的东西列在 `narrowStyles`：`sliderRow`（`flexWrap: wrap`）、`sliderLabel`（`flexBasis: 100%` + `whiteSpace: normal`）、`sliderNote`、`input`（`flex: 1 1 100%`）、`inputAction`、`materialCard`。**没有条目的地方是刻意留白**，不是遗漏：`PacksRow` 不接 `useCompactLayout`，因为它那一行本来就是 `flexWrap: wrap` 的行，按钮自己会换行到下一格。
- 这套算术（列宽 = 标签 + 间隙 + 轨道 + 间隙 + 数值）由 `responsive: the slider and link rows fit every content column` 一条用例逐档核对；`WIDEST_LABEL_PX = 161` 是**活页量到的**最宽滑杆标签（德语弹窗透明度），不是估的。

## §3 按钮词汇表（含"不许钉死高度"这条）

| 样式 | 用于 | 关键几何 | 一行高度怎么算 |
|---|---|---|---|
| `styles.button` | 分区里的一级动作（导入主题包、随机换一个、导出、分享、保存、恢复出厂） | `width: fit-content` / `maxWidth: 100%` / `height: auto` / `minHeight: 32px` / `lineHeight: 18px` / `padding: 6px 14px` / `radius 8px` / `fontSize 13px` / `whiteSpace: normal` | 6 + 18 + 6 + 2(边框) = **32px** |
| `styles.tinyButton` | 卡片内的次级动作（应用 / 收藏 / 移除 / 选择历史） | `minHeight: 26px` / `lineHeight: 24px` / `padding: 0 10px` / `fontSize: 12px` / `whiteSpace: normal`，底色透明 | 0 + 24 + 0 + 2 = **26px** |
| `styles.tinyButtonActive` | 上面那枚的"已选中"叠层（品牌色 + 边框 + 柔和底） | 只叠颜色，不改几何 | 同上 |
| `styles.buttonDanger` | 只改一件事：`color: var(--dsw-alias-state-error-primary)` | 不带几何 | — |
| `styles.textAction` | 行内"撤销我的固定选择 / 取消"这种轻量链接式动作 | 无边框无底色，12px | — |
| `styles.actionRow` | 装上面这些按钮的一行 | `display: flex` / `alignItems: center` / `gap: 12px` / **`flexWrap: wrap`** | — |

**规则：按钮样式不许带固定 `height`。** 页面上每一枚按钮的标签都有八种语言版本，而最窄内容列只有 131px——`height: 32px` 配上 15 个汉字的标签（恢复出厂设置（保留导入内容））就是三行文字塞进一行的高度，等于裁掉两行。改成 `height: auto` + `minHeight` 之后，**单行标签仍然精确是 32px**（见上表算式），所以页面别处不会移动，而长标签可以往下长。这条由 `a translated button label grows instead of losing characters` 钉住，并有一条把 `height: "32px"` 放回去的变异腿证明它会红。

**同一轮里 `textAlign` 被加进又请出。** 修几何时顺手写了 `textAlign: "left"`，它影响的不是那枚出事的按钮，而是 `styles.button` 的 11 个调用点加 `tinyButton` 的 6 个（再经 `inputActionStyle` 转手，共约 20 枚）——一级与卡片按钮的文本全部从居中变左对齐。蓝军把它记成 🟡（B7）后本版**删掉**：折行的长标签居中并不坏，而"顺手把整页按钮的对齐换掉"这件事既没有活页目视，也不属于这个修复的范围。要改对齐请单独一轮，并且八语都要看过。

**危险色只在"已经按下第一次"之后出现**（§4）。未 arm 的恢复出厂就是普通 `styles.button`——常驻红色会把红色训练成"背景噪音"，那正是这个颜色最不该失去的东西。

## §4 两次访问（twice-access）惯例

一个动作如果**当场改变整页外观**或**一次改回全部设置**，第一次点击只 arm，不执行：

1. 标签从"做什么"换成"确认要做什么？"；
2. 叠上 `buttonDanger`（红字），位置与尺寸不变；
3. 旁边**多出一枚 `textAction` 取消**，让"改主意"不必再去点那枚危险的；
4. **不设自动撤回定时器**：定时器是一枚需要随卸载处置的页面级把手，而取消按钮已经覆盖了唯一真实的退出路径。

现存两处：`随机换一个`（`packs.surprise` / `…Armed` / `…Cancel`）与 `恢复出厂设置`（`packs.reset` / `…Armed` / `…Cancel`）。**后者的作用域说明写在未 arm 的标签里**（八语各自带"保留导入内容"这层意思），因为一段常驻小字要么在按下之前不在眼前，要么多花 1.6 KB——选了让按钮自己说清楚。

## §5 导入与导出分区，逐行（as-ships，2026-11-04）

1. `ZoneHeading(zone.packs)`；
2. 动作行（`actionRow`）：**导入主题包** → **随机换一个**（arm 时：红色确认 + 取消） → **导出主题包**（仅当前主题可导出时出现；宿主内置偏好按"没有清单可导出"提示，不静默）→ **复制分享链接**（同上，复制后短暂改标签）+ 隐藏的文件输入；
3. 主题包库：有导入项时是 `role="group"` 的卡片网格（标签 + 应用 / 收藏 / 移除，移除是 `tinyButton + buttonDanger` **一次点击即生效**，因为它只删一个包，不碰整页）；没有导入项时打印 `packs.empty` 一行说明；
4. **恢复出厂设置**（§4 形状，未 arm 时标签即作用域声明）。

### §5.1 轮播那一枚键为什么"有时候不写"，以及为什么它是**复制**而不是合并

`dsh-dream-skin:wallpaper-rotation` 是唯一一枚**字段级**复位键：开关、顺序、间隔、来源回出厂，`urls` 是你录进去的内容。

**第一轮（蓝军 B1 + 裁定 T6）**。这枚键最初走 `writeWallpaperRotationConfig` 的**合并**写，于是它保住的是"这一次读得到的列表"。桌面壳每次换端口、启动时 `localStorage` 恒空，列表只躺在 `$DSH_HOME/dream-skin.json` 里，要等 `loadFromHost()` 采用才可见——在那之前按下复位，合并读到空列表，`urls: []` 被写下去、被推回文件，而且该键进入 `writtenKeys` 之后宿主的真列表**永远不会被采用**。裁定方又否掉了最直觉的修法"等 `hostProbeSettled`"：`loadFromHost()` 有四条退出（采用 / 4s 超时 / `{ok:false}` / 采用环中途抛错），后两条**打开推送闸门却什么都没采用**。
⇒ 门槛是两个条件，缺一不可：**探测已落定** 且 **能读出一枚列表**。不满足就**不写**——不写也就不推，文件里的列表原样保留；探测在飞时按下的，这一段挂起（`parkedRotationReset`），三条落定出口各补一次（`flushParkedRotationReset`）。

**第二轮（对我自己的修法再打一次：蓝军-fix B1/B2/B3/B7）**。第一版仍然有三处会把内容写坏：

- 合并走的 reader 会**去重、拒掉渲染门不放行的条目、截到 20 条**。25 条的文件按一次复位剩 20 条并推回去（B2/B8）。⇒ 现在**从存储串里直接复制 `urls`**，不重走过滤、不截断；读路径每次都会过滤，所以留着一条不放行的条目并不改变页面行为。
- "能不能写"的判据是"原始串非空"，而 `"null"`、`"{}"`、损坏 JSON、数组、`urls` 不是数组全部放行，reader 把它们一律摊成 `urls: []`——推回去就是 B1 换了件衣服（B3）。⇒ 判据改成"能读出一枚列表"（parse 成对象 + `Array.isArray(urls)`），读不出就不写。
- 挂起段在落定时补执行，会**盖掉用户按下复位之后新做的轮播编辑**：点后改成 5 分钟，答复一到变回 60（B1/B7）。⇒ 补执行前先看 `writtenKeys`，用户写过就把债销掉；**宿主采用不算"用户写过"**（采用直接填 `stateCache`，不经过 `writeStorage`），这条区别正是判定能成立的原因，也有用例钉着。

门（`tests/client.factory_reset.test.cjs`）：轮播列表**只放在宿主那一侧**（`hostState` + `without`）才是出事那台机器的形状；一条门一条腿——拆「读得出」⇒ 空列表被写出并推出，只拆 `hostProbeSettled` ⇒ 本地旧列表盖掉宿主新列表，另有「`urls` 送回 reader」⇒ 25 截成 20、「摘掉补执行」⇒ 开关留在 ON、「摘掉顺序守卫」⇒ 按下之后的编辑被抹掉。第一轮那条"两道门一起拆"的腿不算证明：它让第二道门从未被单独检验过（B5）。

## §6 这份规格没有证明什么

- **没有活页目视**。本文件的几何全部来自样式对象的读数与算术；渲染夹具（`tests/fixtures/settings-render.cjs`）自己写明没有 React 协调器、没有布局引擎，所以"三行文字现在真的显示成三行"这件事**仍未被任何地方看过**，131px 那一档尤其。
- §2 的 161px 是唯一一次活页量到的宽度读数，其余是算出来的上界。
- **§5.1 的门槛与挂起没有真机复跑**。四条文本回答全部来自 `tests/fixtures/page-sandbox.cjs`（含新加的 `hostAnswer: 'unreachable' | 'refused'` 两条出口）；真桌面壳的动态端口 + 真 4s 超时没有实测过，超时那条尤其只由"同一 catch"支撑。
- **复位失败仍然没有用户可见文案**（蓝军 B4；第二轮改掉了"守卫包错范围"，但没加文案）。现在的形状是两道门：写阶段抛错 ⇒ `console.warn` 且**什么都不播报**（半恢复的存储上宣称"已恢复出厂"是假话）；重绘阶段抛错 ⇒ 记录 + **照常播报**（存储确实是出厂值，读数可能落后一次交互）。第一轮我把 `try/catch` 只包在 7 个 sync 上，而最可能抛的 `restorePersistedState` 在门外——注入一次 `setTheme` 抛错就能看见：异常从 onClick 冒进宿主 React，播报根本没发。一条"复位没做完"的播报要八条字典串，而 bundle 已在自己声明的天花板下（`tests/package.runtime_size.test.cjs`，剩 14 B），所以这半条留在欠账里。
- **复位过的用户，出厂壁纸按用户值落盘**（蓝军 B3）。`FACTORY_DEFAULTS` 的写入不带 `factory` 标记，所以那张出厂图（现测 4,650 B 的 data-url）进了 `dream-skin.json` 成了"你选的"。第三方实测驳回了"以后拿不到出厂图更新"这个后果方向（迁移按指纹匹配存量值），真代价是文件膨胀与"纯出厂状态不推"这条不变式对复位过的用户不再成立。
- **二次确认在行组件里，不在动作里**（第三方 T4）。`resetFactory` 本身无确认令牌：绕过 UI 直接调它，一下就复位。当前调用点只有那枚按钮和测试夹具的 action bag，所以这是纵深防御的欠缺，不是可达的破坏路径。
- **复位头 retire 在飞的轮播探测（第三方 T1）没有回归用例**。`resetSettingsToFactory` 现在第一件事是 `abandonWallpaperRotation()`，否则一次已经发出的图片探测晚回来会把 `lastRotatedAt` 盖回复位后的 0 并再推一次；但本轮的复位夹具里 `Image` 是空实现（`page-sandbox.cjs`），驱动不了那条晚回来的回调，所以这条只有代码与这段说明，没有门。`tests/client.smoke.test.cjs` 里有可驱动的轮播夹具，下一轮要补就从那里接。
- 若下一轮改了任何一节的形状，**本文必须同轮改**；本文与代码不一致时，以门为准（门会红，本文不会）。
