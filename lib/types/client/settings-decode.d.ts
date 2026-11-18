/**
 * 设置文档 section → `MbsfSettings` 的解码。
 *
 * 从 `index.ts` 的 `install()` 闭包里提出来（2026-09-27）——原因见下。
 *
 * ## 为什么单独成模块
 *
 * 这段逻辑原先埋在 `install()` 内，是闭包，**测不到也查不了**。它漏解码了
 * `autoReclaimEnabled` 等 3 个字段 → 用户点开开关、保存成功（`config.json`
 * 里 `autoReclaimEnabled: true` 落盘无误），但界面读回来是 `undefined`，
 * 渲染回落成默认 `false` ——「保存后弹回」。
 *
 * 病理在于：**写路径没坏，只有读路径坏了**。所以症状是「明明存进去了却显示关」，
 * 而不是「存不进去」。加了字段忘了在这儿加一行 `if`，就复现一次，且**静默**
 * （没有 UI 的字段连症状都没有）。
 *
 * 提出来的目的 = 让它可被 `scripts/check-settings-decode.mjs` 静态 + 行为双重
 * 校验：每次构建时把 `MbsfRuntimeConfig` 的字段名与下面的表做差集，漏一个就
 * 构建失败。**加字段忘了改这里 → 机器拦住，不再靠人肉发现。**
 *
 * ## 加字段时怎么做
 *
 * 1. 在 `runtime-config.ts` 的 `MbsfRuntimeConfig` 加字段（带默认值 + 注释）
 * 2. 在 `mbsf-card-controller.ts` 的 `MbsfSettings` 加同名字段
 * 3. **在下面的 `FIELD_DECODERS` 加一行**
 *
 * 漏了第 3 步 → `pnpm build` 会在 `tsc` 之后直接失败并指名道姓报出字段。
 */
import type { MbsfSettings } from './mbsf-card-controller.ts';
/** `MbsfRuntimeConfig` 的字段名全集（类型层面 = `keyof MbsfSettings`）。 */
export type MbsfSettingsField = keyof MbsfSettings;
/**
 * `MbsfRuntimeConfig` 里那些**必须在设置文档里能读到**的字段。
 *
 * 与 `MbsfSettings` 的键集一致（`Record` 类型已强制），此处导出供构建期
 * 校验脚本交叉比对——脚本不去猜，直接用这一份。
 */
export declare const MBSF_SETTINGS_FIELDS: readonly ["injectEnabled", "dateAnchorEnabled", "autoCompact", "restartCleanupEnabled", "cleanupPruneTurns", "backupKeepCount", "restartButtonVisible", "sessionStreamKeepCount", "dshHeapMb", "autoReclaimEnabled", "autoReclaimThresholdPct", "compactTailMessages", "activityIndicatorEnabled", "activityLabelEnabled"];
/**
 * 把设置文档的 section 收窄成 `MbsfSettings`。
 *
 * **缺席与非法都映射成 `undefined`**（不写进输出对象），让下游 `?? 默认值`
 * 生效；不要用 `false` / `0` 顶替——那会混淆「字段没存过」和「显式存了 false」。
 *
 * @param section - 宿主给的原始 section（可能是 `null`、字符串或任意对象）。
 * @returns 只含合法字段的对象；`section` 不是对象时返回 `{}`。
 */
export declare function decodeMbsfSettings(section: unknown): MbsfSettings;
