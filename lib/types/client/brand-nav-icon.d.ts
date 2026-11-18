/**
 * 设置页导航图标：把宿主默认的齿轮换成品牌图形（2026-11-07 一帆）。
 *
 * ## 为什么不是「注册时传个 icon」
 *
 * `settings.section` 的可选项只有 `id / order / label / locale / inject`——
 * 没有 icon 字段。导航图标由宿主 `dsh-client-ui-settings-general` 里一个写死的
 * `navIcon(id)` 决定：认识 `models` / `agent-presets` / `plugins` 三个 id，
 * **其余一律回落到齿轮**。我们没有官方扩展点可用。
 *
 * ## 为什么是「隐藏 + 旁边插一个」而不是「替换掉」
 *
 * 那个 `<svg>` 是 React 渲染的节点。把它从 DOM 里换成别的标签，等于在 React
 * 不知情的情况下抽走它持有的子节点——后续任何一次 re-render / 卸载都可能抛
 * `NotFoundError: The node to be removed is not a child of this node`。
 * 所以这里只做两件 React 能容忍的事：
 *   1. 把原 svg 设为 `display:none`（样式层面，不碰树）
 *   2. 在它**旁边**插一个 `span`（多一个兄弟节点，React 不持有它）
 *
 * ## 为什么用 mask 而不是 <img>
 *
 * 合体图是黑字白底 JPEG；导航栏要跟随主题（深色模式下白底图标 = 一块白砖）。
 * `mask-image` + `background: currentColor` 只取形状、颜色交给 CSS，两套主题
 * 都不用出第二张图。所以 `MBSF_LOGO_GLYPH_DATA_URL` 是**透明底 PNG**。
 *
 * ## 失效姿态
 *
 * 认不出导航条（宿主改了结构 / 改了 class / 改成了别的标签）→ 什么都不做，
 * 界面上仍然是原来的齿轮。这是个装饰性改动，退化不该比没有更糟。
 */
/**
 * 给「文字等于本插件导航名」的那个按钮补上品牌图形。
 *
 * @param label 当前语言的导航名（`t('nav')`——所有语言都是「未必科幻MBSF」）
 * @returns 是否找到了目标按钮（找不到 = 面板还没打开，不算错误）
 */
export declare function decorateNavIcon(label: string): boolean;
/**
 * 装上观察器：设置面板每次打开都是新挂载的 DOM，所以不能只在启动时做一次。
 * 监视 `body` 的子树变化，去抖后重扫——命中即幂等（已替换过会直接返回）。
 *
 * @returns 拆卸函数（插件卸载 / 热重载时调用）
 */
export declare function watchNavIcon(label: () => string): () => void;
