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
| `styles.button` | 分区里的一级动作（导入主题包、随机换一个、导出、分享、保存、恢复出厂） | `width: fit-content` / `maxWidth: 100%` / `height: auto` / `minHeight: 32px` / `lineHeight: 18px` / `padding: 6px 14px` / `radius 8px` / `fontSize 13px` / `whiteSpace: normal` / `textAlign: left` | 6 + 18 + 6 + 2(边框) = **32px** |
| `styles.tinyButton` | 卡片内的次级动作（应用 / 收藏 / 移除 / 选择历史） | `minHeight: 26px` / `lineHeight: 24px` / `padding: 0 10px` / `fontSize: 12px` / `whiteSpace: normal`，底色透明 | 0 + 24 + 0 + 2 = **26px** |
| `styles.tinyButtonActive` | 上面那枚的"已选中"叠层（品牌色 + 边框 + 柔和底） | 只叠颜色，不改几何 | 同上 |
| `styles.buttonDanger` | 只改一件事：`color: var(--dsw-alias-state-error-primary)` | 不带几何 | — |
| `styles.textAction` | 行内"撤销我的固定选择 / 取消"这种轻量链接式动作 | 无边框无底色，12px | — |
| `styles.actionRow` | 装上面这些按钮的一行 | `display: flex` / `alignItems: center` / `gap: 12px` / **`flexWrap: wrap`** | — |

**规则：按钮样式不许带固定 `height`。** 页面上每一枚按钮的标签都有八种语言版本，而最窄内容列只有 131px——`height: 32px` 配上 15 个汉字的标签（恢复出厂设置（保留导入内容））就是三行文字塞进一行的高度，等于裁掉两行。改成 `height: auto` + `minHeight` 之后，**单行标签仍然精确是 32px**（见上表算式），所以页面别处不会移动，而长标签可以往下长。这条由 `a translated button label grows instead of losing characters` 钉住，并有一条把 `height: "32px"` 放回去的变异腿证明它会红。

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

## §6 这份规格没有证明什么

- **没有活页目视**。本文件的几何全部来自样式对象的读数与算术；渲染夹具（`tests/fixtures/settings-render.cjs`）自己写明没有 React 协调器、没有布局引擎，所以"三行文字现在真的显示成三行"这件事**仍未被任何地方看过**，131px 那一档尤其。
- §2 的 161px 是唯一一次活页量到的宽度读数，其余是算出来的上界。
- 若下一轮改了任何一节的形状，**本文必须同轮改**；本文与代码不一致时，以门为准（门会红，本文不会）。
