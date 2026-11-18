/**
 * 宿主域锚点入口（2026-09-27 合并重构）。
 *
 * **为什么需要这个空壳**：本包同时提供
 *   ① 压缩引擎（`./compaction`，真实现，由 preset 的 compaction 组挂载）
 *   ② 浏览器半（`dsh.client` + `exports['./client']`，未必记忆设置页与 🐾 浮窗）
 *
 * 而 `dsh-client-modules` 只把**裸包名**行当作 client source（子路径行会被
 * `locatePkgJson` 的守卫挡掉），且**一个包最多一个 source**。引擎原先唯一的
 * 裸名行在**小爪 preset 的 compaction 组**里，而 preset 树是 `PresetTree`
 * 刻意从宿主树摘出去的（构造函数里存下 `owner.subtree` 再还原）⟹ preset 行
 * 对 client-modules 不可见 ⟹ 浏览器半永远不会被加载。
 *
 * 于是本包在**宿主域**需要一个裸名行当锚点：就是这一行。它的宿主半刻意
 * **什么都不做**——引擎仍由 preset 的 `./compaction` 行按 realm 挂载，
 * 保持「每个 preset 一个压缩后端」的隔离语义不被破坏（同一层挂两个后端
 * 会同时压同一个会话，2026-09-14 实测 59.6% 失败）。
 *
 * 2026-10-14 补：本入口**不再是纯空壳**——它在锚点职责之外顺带挂载
 * **MBSF 活动投影**（`mbsfActivity`，🐾 浮窗活动指示器的数据源，定义见
 * `./mbsf-activity.ts`）。之所以能安全地加在这里：投影是**只读 fold**，
 * 不碰压缩事务、不共享引擎运行时状态 ⟹ 不破坏上面那条隔离语义。
 *
 * @module mbsf-compaction
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * 宿主半：注册 MBSF 活动投影。
 *
 * **刻意用 `ctx.inject`（可选）而不是 `export const inject`（强制）**：
 * 本入口同时是浏览器半的 client source 锚点——若 `sessionProjections` 缺席
 * 时本插件整体不加载，锚点消失 ⟹ 🐾 浮窗与设置页一起消失（远超投影本身
 * 的收益）。可选注册下：服务在则注册投影，不在则静默跳过，锚点职责不受
 * 影响（契约明示此路可行——`dsh-session-projection` index.d.ts:129）。
 *
 * @param ctx - 宿主域 cordis 上下文。
 */
export declare function apply(ctx: Context): void;
