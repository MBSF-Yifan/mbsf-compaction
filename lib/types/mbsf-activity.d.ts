/**
 * MBSF 活动投影（host 半）——🐾 浮窗活动指示器的数据源。
 *
 * ── 为什么需要（2026-10-14 一帆需求）────────────────────────────────
 * 十个 mbsf_* 工具（recall / recall_content / walk / wengu / get / around /
 * describe / generate / nominate / forget）与 γ 压缩在 UI 上**完全不可见**——用户看不到「引擎正在干活」，
 * 长耗时调用（recall 冷启动、压缩事务）期间界面像卡死。本投影把「正在
 * 做什么」以最小代价送到浮窗。
 *
 * ── 为什么走 session-projection（而不是轮询 / 自建通道）──────────────
 * projection 是 DSH **框架原生的 push 通道**：host 注册一个纯 fold，框架在
 * 每次**已提交**会话事件上驱动 `apply`，客户端 `props.useProjection
 * ('mbsfActivity')` 直接拿成品值。零轮询、零自建 IPC。
 *
 * 且压缩事件与工具事件**同源**：`compaction/start|end` 由基类
 * `BasicCompactionEngine` 发射（`dsh-compaction-basic` lib/index.js:452/467），
 * MBSF 继承该基类且不覆写 `compactRegion` ⟹ 压缩事务自动留下这两个事件 ⟹
 * 「读 / 写 / 压」三类天然走同一条日志，不需要额外埋点。
 *
 * ── 三类活动 = 判定依据 的工程切面  ──────────────────────────────
 * 这不是正典推导，是动作在工程上的**切面**（标 ，不标
 * ）：
 *   · 读（recall / recall_content / walk / wengu）= `=` 识别——一个位置**展开**成内容
 *   · 写（nominate / forget）                     = `D` 区分——内容**落成**一个位置
 *   · 压（compaction）                            = `=` 识别——多条**归并**成一个
 *
 * 注意「压」在里**没有**原生动作——最接近织入（ ④）但本质
 * 仍是 `=`（识别这些属于同一话题 → 归并）⟹ 三类是 `判定依据` 两个方向的切面，
 * **不是一个三分法**（`D` 一个：写；`=` 两个方向：读展开 / 压归并）。
 * UI 动画方向由此而来：读外扩、写内收、压对折。
 *
 * ── 注册方式：可选（ctx.inject）而非强制（inject）───────────────────
 * 本包在宿主域是**浏览器半的 client source 锚点**（见 index.ts 头注）——若用
 * `export const inject = ['sessionProjections']`，在没有该服务的 profile 里
 * 整个 `lib/index.js` 不加载 ⟹ client 锚点消失 ⟹ 🐾 浮窗与设置页一起消失。
 * 故由 index.ts 走 `ctx.inject([...])` 可选注册：服务在则注册投影，不在则
 * 静默跳过，**宿主锚点职责不受影响**（契约明示此路可行——index.d.ts:129）。
 *
 * ── stateVersion ────────────────────────────────────────────────────
 * 当前 2。**仅在序列化字段或 fold 语义变更时递增**（框架据此丢弃旧持久化
 * 缓存行 `(sessionId, key, ver, seq, val)` 而非前向套用成垃圾）——纯 UI
 * 改动不动它。
 *
 * v2（2026-10-14）：修 `tool/result` 取 callId 的路径 + `turn/end` 清栈兜底
 *   （两处都改了 fold 语义，见 `resultCallId` 与 `applyMbsfActivity` 注释）。
 *
 * @module mbsf-compaction/mbsf-activity
 */
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
/** 活动类别（`判定依据` 的工程切面——见文件头注 ）。 */
export type MbsfActivityKind = 'read' | 'write' | 'compact';
/** 当前活跃动作（内部记账值）。 */
export interface MbsfActivity {
    /** 类别：读（展开）/ 写（落位）/ 压（归并）。 */
    kind: MbsfActivityKind;
    /** 工具短名：recall / walk / wengu / nominate / forget / compact。 */
    tool: string;
}
/**
 * 客户端可见的 wire 值（`useProjection('mbsfActivity')` 读到的东西）。
 *
 * ── 为什么不是裸的 `MbsfActivity | null`（2026-10-14 五轮·一帆：「写入
 *    动画从未出现」——一次真实故障）────────────────────────────────────
 * 原 wire 只有「当前值」一个字段，**无法区分「什么都没发生」与「发生了
 * 但已经结束」**。这在单帧场景下没问题，但写类调用（nominate / forget）
 * 的真实间隔是 **6~8ms**（实测会话日志）：
 *
 *     tool/call t=1791842119713  →  tool/result t=1791842119721   (8ms)
 *
 * 而客户端投影 store 的通知是**微任务批处理**的
 * （`ProjectionValueStore.changed` → `Notifier.markDirty` →
 * `queueMicrotask`，见 `dsh-api-session-controller` 的 `notifier.js`）：
 * 宿主虽为两个事件各发一帧（`drive()` 逐事件判 `Object.is(view)`，见
 * `dsh-session-projection/lib/index.js`），但两帧**落在同一个微任务队列里**
 * ⟹ 客户端只渲染一次 ⟹ `getSnapshot()` 直接读到 `null`，中间那个
 * `{kind:'write'}` 值**从未进入 React**。
 *
 * 后果不是「动画太快看不见」，而是**写入动画从未被渲染过一次**
 * （`useStickyActivity` 只在 `activity !== null` 时 `setSticky`，该分支
 * 永不执行）。对照实测：读类调用间隔 6354~29299ms，两帧分得很开，
 * 动画一直正常——**只有写类落在这个合并窗口里**。
 *
 * ⟹ 修法：把「发生过动作」这件事从**会归零的值**里独立出来，用两个
 * 字段承载：
 *   · `epoch` —— 单调递增的动作计数。值可以回到 `null`，epoch 不会，
 *     故合并帧下客户端仍能看出「动过」。
 *   · `last`  —— 最后一次发生过的动作。epoch 告诉客户端「动过」，
 *     `last` 告诉它「动的是哪个形态」（write 还是 read）——缺了它，
 *     客户端知道有事发生却不知道该播哪种动画。
 *
 * ⚠ `current` 与 `last` 的区别：`current` 是**当前**活跃动作（判「语义是否
 * 变化」以复用引用用的就是它），`last` 是**历史**（空闲时不清空——清了就又
 * 被合并吃掉了）。
 */
export interface MbsfActivityWire {
    /** 当前活跃动作；`null` = 空闲。 */
    current: MbsfActivity | null;
    /** 最后一次发生过的动作；从未有过动作时 `null`。空闲时**保留**。 */
    last: MbsfActivity | null;
    /** 单调递增的动作序号——每发生一次新动作 +1（合并帧下仍可辨）。 */
    epoch: number;
}
/** 一次活跃的工具调用（内部记账，不进 wire）。 */
interface MbsfCall {
    /** 会话内唯一的调用 id（`tool/call` 的 callId）。 */
    id: string;
    kind: MbsfActivityKind;
    tool: string;
}
/**
 * 投影状态（纯 JSON——持久化缓存的前提）。
 *
 * `wire` 是**已构造好的客户端可见值**，`view` 直接返回它——引用天然复用
 * （框架按 `Object.is` 比较 view 结果，语义未变时不发布 ⟹ 零多余渲染）。
 *
 * ⚠ 为什么不存 `activity` 再由 `view` 现场拼对象：那样每次 `view` 调用都会
 * 造新对象 ⟹ `Object.is` 永远 false ⟹ 语义未变也发布（违反本文件的引用
 * 复用契约）。故把 wire 值本身存进状态，由 `commit` 保证复用。
 */
export interface MbsfActivityState {
    /** 客户端可见值（当前 + 最后 + 序号）——语义未变时保持同一引用。 */
    wire: MbsfActivityWire;
    /** 活跃的工具调用栈（后进先出取最后一项——并行调用时显示最新那个）。 */
    calls: MbsfCall[];
    /** 活跃的压缩事务 id（基类持 busy 锁故通常 0 或 1 项，仍按集合记账）。 */
    compacting: string[];
}
/**
 * 纯 fold：把一条已提交会话事件折进状态。
 *
 * **不相关事件必须返回同一引用**（契约：同引用 ⟹ 下游零工作）。
 * @param state - 覆盖此前全部事件的状态。
 * @param event - 下一条已提交会话事件。
 * @returns 下一状态（事件无关时同引用）。
 */
export declare function applyMbsfActivity(state: MbsfActivityState, event: SessionEvent): MbsfActivityState;
/**
 * `mbsfActivity` 投影单元：读 / 写 / 压三类活动的纯 fold + 客户端视图。
 *
 * 注册点见 `./index.ts`（`ctx.inject(['sessionProjections'], …)` 可选注册）。
 *
 * 类型注记：`ProjectionDefinition.wire` 在接口里是**可选**的，而
 * `register` 的客户端可见重载要求它**必需**——直接标注
 * `ProjectionDefinition<'mbsfActivity'>` 会因「可选 vs 必需」而落进
 * host-only 重载并报 key 不匹配。故此处显式写 `wire` 必需的交集型
 * （与 `register` 重载 1 的参数形状一致），类型自洽后重载自然命中。
 */
export declare const mbsfActivityProjection: ProjectionDefinition<'mbsfActivity'> & {
    wire: NonNullable<ProjectionDefinition<'mbsfActivity'>['wire']>;
};
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        /** MBSF 活动投影的内部记账（host 侧）。 */
        mbsfActivity: MbsfActivityState;
    }
    interface SessionProjectionMap {
        /**
         * 当前活跃的 MBSF 动作 + 最后一次动作 + 动作序号。
         * 读 / 写 由 `mbsf_*` 工具调用压缩，压由 `compaction/start|end` 压缩。
         *
         * ⚠ 不是裸的 `MbsfActivity | null`——短命动作（写类实测仅 6~8ms）会在客户端
         * 的微任务批处理里被吃掉，`epoch` 是让它可见的唯一载荷（见 `MbsfActivityWire`）。
         */
        mbsfActivity: MbsfActivityWire;
    }
}
export {};
