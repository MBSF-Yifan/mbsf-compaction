/**
 * 未必记忆 compaction backend — Harness 插件入口
 *
 * `MbsfCompactionEngine extends BasicCompactionEngine`，覆写两处：
 * `summarize()`（BasicCompactionEngine 官方预留的 customization hook——
 * docs/subsystems/compaction.md: "Override this sole hook for a template or
 * remote summarizer"）+ `compactIfNeeded()`（'pressure' 分支：γ 冗余分析替代
 * token 阈值 + 结构闭合门 structuralTurnGate 把关 + 边界钩子提前压缩——
 * 2026-08-29 方案 B / 09-06 改造 A+B：压缩主触发点 = agent/turn-stopping
 * 回合收尾边界（idle 降兜底），pre-step running 中同步压缩移除，见
 * 05-工程接线 §5.1）。压缩的触发策略 / 区间选择 / 持久化替换其余复用
 * compaction-basic，摘要由未必记忆编码 + γ 冗余判定生成，
 * 零 LLM 调用。
 *
 * @module mbsf-compaction
 */
import { BasicCompactionEngine, type BasicCompactionConfig } from '@deepseek-ai/dsh-compaction-basic';
import { type CompactionResult, type CompactionTrigger } from '@deepseek-ai/dsh-compaction';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Context } from '@deepseek-ai/cordis';
import { type ContentBlock } from '@deepseek-ai/dsh-llm';
import { type StructuralGateOptions, latencyStats, mbsfStats, lastSummarizeStats, foldHistory, type FoldHistoryEntry, INJECT_PREFIX, isInjectSource } from '@mbsf/core';
import { getRuntimeConfig, setRuntimeConfig, loadRuntimeConfig, type MbsfRuntimeConfig, resolveDshHeapMaxMb, normalizeDshHeapMb, withDshHeapFlags, ensureHeapSnapshotDir, heapSnapshotDir, DSH_HEAP_DEFAULT_MB, DSH_HEAP_MIN_MB, DSH_HEAP_RESERVE_MB, AUTO_RECLAIM_PCT_MIN, AUTO_RECLAIM_PCT_MAX, AUTO_RECLAIM_PCT_DEFAULT, COMPACT_TAIL_MESSAGES_MIN, COMPACT_TAIL_MESSAGES_MAX, clampTailMessages } from './runtime-config.ts';
import { maybeScheduleRestart, readResetRequest, clearResetRequest, resetRequestPath, resetRunnerPath, SESSION_RESET_MIN_TURNS, type ResetRequest } from './session-reset.ts';
import { idleSnapshot, isIdle } from './idle-signal.ts';
import { catalogProbeReport, verifierProbeReport } from './session-format-v3.ts';
/**
 * 层2 位置层回想接口（附录E E.2 落地）：编码查询词 → ω 命中话题 → 返回
 * 该话题的片段位置（会话存档位置 / 记忆文件路径）。零 LLM、本地毫秒级。
 * 供 Harness 侧会话工具/命令调用；位置层未初始化时自动懒初始化。
 * recallContent = 回想完整两步（C.7 定稿）：入口识别 + trace 走回原文
 * （重演该段线，F.6.3）。mergeFragmentedTopics = 碎片话题合并（C.5
 * 语义同型：子链包含 OR 同根 LCP ≥ 2（FRAGMENT_CHAIN_MIN），全库跨线
 * （§9.3.4 跨线识别）——2026-08-29 判据统一，任意位置 LCSubstr 撤回）。
 * indexWorkspaceMemoryFiles = 记忆家目录同步（E.11）：把 MEMORY.md /
 * memory/*.md 等档案文件登记进位置层，让回忆能命中档案原文。
 * compressTopicClosure(s) = 闭包压缩（PLAN-PHASE1 Step 5：闭合话题 →
 * 单个代表 ω——成员方向规范化叠加合成公共方向，不更新话题中心）。
 * fragmentWithGaps / expandFootprint / buildV0Conditional(FromIndex) =
 * 特征生成机制 A+B（C.14 工程含义落地，2026-08-19）：压缩侧保留间隙
 * 标记（位置层载体），生成侧 cond 策略铺回块（代表可读文本）。
 */
export { mbsfStats, lastSummarizeStats, latencyStats, foldHistory, type FoldHistoryEntry, idleSnapshot, isIdle, catalogProbeReport, verifierProbeReport, };
export { INJECT_PREFIX, isInjectSource, };
export { getRuntimeConfig, setRuntimeConfig, loadRuntimeConfig, type MbsfRuntimeConfig, resolveDshHeapMaxMb, normalizeDshHeapMb, withDshHeapFlags, ensureHeapSnapshotDir, heapSnapshotDir, DSH_HEAP_DEFAULT_MB, DSH_HEAP_MIN_MB, DSH_HEAP_RESERVE_MB, AUTO_RECLAIM_PCT_MIN, AUTO_RECLAIM_PCT_MAX, AUTO_RECLAIM_PCT_DEFAULT, COMPACT_TAIL_MESSAGES_MIN, COMPACT_TAIL_MESSAGES_MAX, clampTailMessages, };
export { maybeScheduleRestart, readResetRequest, clearResetRequest, resetRequestPath, resetRunnerPath, SESSION_RESET_MIN_TURNS, type ResetRequest, };
/**
 * 与 compaction-basic `SummarizationInput` 结构等价的宽松结构（方法参数
 * 双向协变，允许超类型）。字段含义：
 *  - system: 会话自身的 system prompt
 *  - tools: 会话工具 schema
 *  - messages: 被压缩区间消息（surface order）
 */
interface SummarizeInput {
    system?: string;
    tools?: readonly unknown[];
    messages: readonly unknown[];
}
/** 与 compaction-basic `SummaryResult` 的 unmarked 分支结构等价。 */
interface SummarizeOutput {
    summary: ContentBlock[];
    provider: string;
    model: string;
    rawOutput?: ContentBlock[];
    llmStreamCall?: never;
}
/**
 * 未必记忆后端：γ 差分压缩摘要，无 LLM。
 *
 * 输入是 compaction-basic 选定的 shadowed 区间消息（system/tools/messages
 * 前缀，与最后一次路由请求对齐）；输出是纯文本摘要块，将替换整个区间。
 *
 * 2026-11-08 删除 thresholdRatio / retainRatio 默认值（一帆「是不是可以直接
 * 去除」+ 代码审计确认）：
 *  - 父类的 thresholdTokens 判定只在 `compactIfNeeded(trigger='pressure')`
 *    的基类实现里；mbsf 覆写了该方法，pressure 分支**不调 super**（只有
 *    context-overflow 走 super，而该分支用 `selectCompactableRange(..., 0)`，
 *    不看 threshold）；
 *  - 基类 hook 每步调用也被 mbsf 的 B 拦截（无 opts 非 force → null）。
 *  ⟹ 两个默认值对 mbsf 的实际行为零影响（实测 95 条诊断：真正触发 =
 *  每回合用户消息 closure + 回合收尾 + 85% 上下文守卫 force）。
 *  删除默认值后父类退回自己的默认（行为仍不生效）；字段保留在
 *  MbsfConfig（BasicCompactionConfig）里只为类型兼容——用户 config 若显式
 *  传仍会传给父类，但同样不影响 mbsf 路径。
 *
 * 压缩时机定位（2026-09-01 审查）：压缩 = 「停」的结算（识别即止
 * ——，交替递推）——**按需 = 按需驱动**：主路径
 * 已按需——turn-stopping closure（回合收尾 = 一个步的结算点触发，见
 * _registerTurnBoundaryClosure）+ structuralTailGate（tail = 未闭合链链头，未闭合
 * 保留 = 层3 只保留未闭合链）；thresholdRatio 只作**工程边界兜底**
 * （容量保险丝，同 MAX_BODY_CHARS 待遇：防 provider 溢出，正常由
 * 结构闭合驱动、不撞此墙）——不参与「该不该压缩」的结构判定。
 */
/** 引擎配置：压缩配置 + 注入预算的上下文容量参照。 */
export interface MbsfConfig extends BasicCompactionConfig {
    /** 注入预算的上下文容量参照（token；默认 1M， 粗上界安全网——
     *  per-target 容量在 compaction-basic 路由时才解析，pre-step 热路径
     *  不做精确用量扫描）。 */
    contextWindow?: number;
}
export declare class MbsfCompactionEngine extends BasicCompactionEngine {
    /** 注入预算的上下文容量参照（token； 粗上界——per-target 容量
     *  在 compaction-basic 路由时才解析，pre-step 热路径不做精确用量扫描。
     *  默认 1M 对齐引擎注释（OpenClaw 256K→1M 演进）；config.contextWindow
     *  可覆盖。弱预算再乘 remainSafeRatio=0.1 = 40 万字符安全网，实际恒被
     *  特征比例（×0.3）与硬顶（3000）约束，此参数只作理论兜底）。 */
    readonly contextWindowTokens: number;
    constructor(ctx: Context, config?: MbsfConfig);
    /**
     * 用户发消息后压缩·主触发点（2026-09-10 一帆「压缩时机从会话结束改到
     * 用户发消息后」固化——取代 2026-08-30「会话结束后压缩」作为主路径）：
     * 用户发出消息、本轮推理开始之前，把已闭合的历史压掉（γ 零 LLM）。
     *
     * 时序依据（为什么"发消息后压"能立刻生效——已核 DSH 源码）：agent-loop
     * 的 `preStep()` 在 `append('user/message')` **之前**派发本 hook
     * （packages/core/agent-loop/src/agent.ts:235），而 `step()` 的模型请求
     * 上下文由 `session.deriveMessages()` **实时推导**（同文件:341）——因此
     * 此处同步 await 压完，紧随其后的本轮推理拿到的正是「压缩后的历史 +
     * 新用户消息」。
     *
     * 判定：回合首步（`step === 1`）且本步 claim 到真实用户消息（`source.kind
     * === 'user'`——goal round 续跑消息 kind='goal' 是状态机骨架、系统注入
     * 消息 kind='plugin'/'skill-catalog' 非用户发言，均不触发）；每回合至多
     * 触发一次（WeakMap 节流——2026-09-06 复盘固化：压缩不占推理热路径，同
     * 回合多步不重复跑守卫链）。
     *
     * 结构门：调用带空 opts（非 undefined）= 放行 compactIfNeeded 的「pre-step
     * 非 force 挂起」拦截（2026-09-06 改造 B）；此时 turn/start 已写、turn/end
     * 未写 → structuralTurnGate 走收缩分支，压缩区自动收到当前回合第一条消息
     * 之前——只压历史，不动本轮（用户正在阅读的链不断）。
     *
     * 兜底：turn-stopping（回合收尾，2026-09-10 一帆确认）——重复压缩由守卫链
     * 拦截（surface 无新冗余 → null）。
     *
     * 行为：
     *  - 失败静默：try/catch + return next()（压缩是增强，不阻断推理）；
     *  - 并发安全：compactRegion 自带 busy 锁，与兜底触发互斥；
     *  - 开关：compactIfNeeded 内部读 runtime-config 的 autoCompact（实时）。
     */
    private _registerUserMessageClosure;
    /**
     * 记忆自动按需浮现（E.24 定稿 / 7.6.1 + P0 #5）：agent/pre-step 每步
     * 判定一次——特征（最近输出 + 最新输入）→ recallContent（需判门控）→
     * 接续度自适应选择 → 📎 注入消息并进 step 输入。LLM 无感 + 用户可见。
     *
     * ⚠️ 状态注记（2026-09-01 审计③）：注入正文 = 定义当回忆过渡形态
     * （representativeText = 首次产生 label——7.9.3 重做根因，见 注入层
     * 注释）；**默认关维持**（不注入 = 基线，2026-08-24 语义反转；UI 配置
     * 面板可实时开）——期②路径骨架（pathText）落地 + 观测验证前不评估
     * 默认开（重做根因未除，开了 = 把「定义」当「回忆」喂给 LLM）。
     *
     * 行为：
     *  - 特征太短（< MIN_FOOTPRINT_CHARS）= 无新增量 = 不注入（不吵）；
     *  - == 真止（need=true）必注入，数量由分岔结构产生（命中几条注几条）；
     *  - 判定 过渡止（need=false）不注入——`=` 是离散事件，没识别 = 不注入（Round 9 弱接续预算路径已删，无预算参数）；
     *  - 同 turn 幂等（topicId 去重）+ 特征排除注入消息自身（防自我强化环）；
     *  - 任何失败静默降级 return next()（注入是增强，不阻断推理）。
     */
    private _registerStepInjection;
    /**
     * 【已删除·2026-09-14】idle closure 兜底（原方案 B 2026-08-29 引入）。
     *
     * 删除依据 = 运行时实证（不留"看起来有兜底"的假象）：
     *  - **结构性不可用**：idle 时无进行中回合，compactRegion 直接抛
     *    「no open turn — automatic compaction events must be enclosed in a
     *    turn」（DSH 不变式：自动压缩事件必须被 turn 包裹）。探针实证
     *    2026-09-14T09:37:55Z：`idle: compactIfNeeded 异常 compactRegion:
     *    no open turn`——turn-stopping 能成是因为它传了
     *    `{ allowOpenTurn: true }`（见下）。
     *  - **零次成功**：idle-probe.log 全量（2026-09-09 → 09-14）统计，
     *    idle 触发成功压缩 **0 次**（turn-stopping 675 / user-message 32）；
     *    其覆盖范围被 turn-stopping 完全包含，且每次 idle 都写异常日志。
     *
     * 压缩落位链现为三层：turn-stopping（主，回合收尾）→ user-message
     * （保险，回合首步补漏）→ context-overflow（DSH 溢出强制）。若将来 DSH
     * 放宽「压缩事件必须被 turn 包裹」的不变式，再考虑恢复。
     */
    /**
     * 压缩落位链收尾边界·主触发点（2026-09-06 改造 A——一帆「发触发真发去」
     * 复盘固化：压缩必须发生在结构真的闭合的瞬间，不靠事后机会）：agent-loop
     * 每回合最后一步走完、turnEnds 且 inbox 无排队下一步时派发
     * agent/turn-stopping（packages/core/agent-loop/src/agent.ts:295）——这是
     * 回合收尾的确定性边界，比 idle 更早更可靠（覆盖「回合结束但立即排队开
     * 新回合、中间无 idle 窗口」：排队场景下旧回合的压缩不等下回合结束）。
     *
     * 时序：dispatch.serial 派发时本回合的 turn/end 尚未写入（turn() 的
     * finally 才 append），结构门看到「有进行中回合」——因此调用必须带
     * opts.allowOpenTurn = true（收尾回合不会再增长 = 已闭合，豁免进行中
     * 拦截；首回合收尾同样放行——见 structuralTurnGate 2026-09-06 注释）。
     * handler 内 fire-and-forget（void）——不 await 压缩，serial 立即返回，
     * turn/end 由 finally 正常写入；压缩守卫链的同步段在 handler 返回前已
     * 跑完（此刻 turn/end 未写 = allowOpenTurn 是必需路径而非兜底），
     * compactRegion 的事务在事件循环后续执行（turn/end 已写，无冲突）。
     *
     * 行为：
     *  - 无节流：turn-stopping 每回合至多派发一次（agent-loop 触发后 break），
     *    重复压缩由 compactIfNeeded 内部守卫拦截（surface 无新冗余 → null）；
     *  - 并发安全：compactRegion 自带 busy 锁，与下一回合 pre-step 的守卫
     *    force 压缩互斥（busy 锁挡）；
     *  - 失败静默：fire-and-forget + try/catch（压缩是增强，不阻断生命周期）。
     */
    private _registerTurnBoundaryClosure;
    /**
     * 每轮 γ 压缩（对齐 OpenClaw before_prompt_build 语义）：
     * γ 冗余分析替代 token 阈值——只要有可压缩冗余就落地压缩，不等 token
     * 涨到阈值。
     *
     * 触发策略（2026-09-06 改造 A+B 固化——一帆「发触发真发去」复盘）：
     * **γ 压缩只在结构闭合边界触发，running 中（pre-step）不压缩**——基类
     * 在 agent/pre-step 每步调用本方法（无 opts 非 force），B 拦截直接
     * return null（此前 running 中每步都跑 O(surface) 守卫 + 结构门同步段，
     * 曾实测把 LLM 推理请求拖慢 3 次 pre-step 同步）。真正触发者：
     *  - agent/turn-stopping 收尾边界（主触发点，_registerTurnBoundaryClosure
     *    ——带 opts { allowOpenTurn: true }：回合逻辑走完、turn/end 未写，
     *    结构门豁免进行中拦截）；
     *  - 上下文守卫 force（runContextGuard——token 溢出救火，force 豁免
     *    拦截与结构门，保留阻塞性：宁可阻塞不可溢出死锁）；
     *  - context-overflow 恢复分支（走 super，保持基类逻辑）。
     *
     * 行为：
     *  - 跳过已有 checkpoint（含标记的消息），避免链式重复压缩同一摘要；
     *  - tail 自适应保留（1-5 轮，γ EMA / radical 衰减驱动），tail 前若有
     *    真实消息即可压（至少压 1 条、tail 至少留 2 条）；
     *  - 压缩区结束处必须是 tool 配对平衡边界，绝不切开未完成的 tool call/result；
     *  - 压缩区间从 surface 最老节点开始（含 checkpoint），新摘要压缩旧摘要
     *    （extractPreviousCheckpoint → previousSummary 头部），历史持续精简。
     *
     * context-overflow 分支保持基类逻辑（provider 确认溢出时强制恢复）。
     *
     * @param opts - boundary 来源标记：idle / turn-stopping 钩子传入（空对象
     *  或 { allowOpenTurn }）。undefined = 基类 pre-step hook 的 running 中
     *  调用 → 非 force 一律 return null（2026-09-06 B）。force（守卫救火）
     *  不依赖 opts。
     */
    compactIfNeeded(agent: Agent, trigger: CompactionTrigger, signal: AbortSignal, force?: boolean, opts?: StructuralGateOptions): Promise<CompactionResult | null>;
    /**
     * 未必记忆 γ 压缩：零 LLM。摘要 = 冗余压缩 + 高 γ（新方向）消息保留。
     * 前序 checkpoint（若有）被压缩进摘要头部。
     * @param input - 被压缩区间的会话前缀（system + tools + messages）。
     * @param agent - 会话所有者，提供 session id 作为 γ 参照。
     * @param signal - 取消信号；中止时立即抛出。
     * @returns 纯文本摘要块 + mbsf/local 调用信封（无 LLM 调用标记）。
     */
    protected summarize(input: SummarizeInput, agent: Agent, signal?: AbortSignal): Promise<SummarizeOutput>;
}
/** 清派生缓存（2026-11-09 公开版「立即省内存」）：清掉可重算的 Map。
 *  清后下次预检/锚定重新计算（多花几 ms），内存立刻下降；不删任何持久数据。 */
export declare function clearDerivedCaches(): Record<string, number>;
export default MbsfCompactionEngine;
