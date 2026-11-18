/**
 * 未必记忆运行时配置（UI 配置面板的可编辑层）
 *
 * 分层：
 *  - env 提供初始默认（`MBSF_INJECT_DISABLED` 决定注入默认关；
 *    autoCompact 默认开）——只影响首次加载。
 *  - `~/.mbsf/config.json` 是用户覆盖层：UI 配置面板经
 *    dsh-settings namespace（`electronic-sheep`）写入，status-gateway 的
 *    watch 回调调用 setRuntimeConfig 落盘并更新内存单例。
 *
 * 生效方式：引擎每次压缩/注入从内存单例读取（非构造快照）——运行中
 * 切换实时生效，无需重启。config.json 一旦存在即优先于 env 默认。
 *
 * @module mbsf-compaction/runtime-config
 */
/** UI 可编辑的运行时配置项。 */
export interface MbsfRuntimeConfig {
    /** 记忆浮现（注入）开关——默认关（env `MBSF_INJECT_DISABLED` 反推）。 */
    injectEnabled: boolean;
    /** 日期锚点注入开关——默认开（env `MBSF_DATE_ANCHOR_DISABLED` 反推）。
     *  每会话每天首次 pre-step 注入「当前日期 = <系统时钟>」坐标参照消息（独立于
     *  injectEnabled——锚点是坐标落点非记忆内容；2026-09-01 日期编造事故固化）。 */
    dateAnchorEnabled: boolean;
    /** γ 自动压缩开关——默认开。关闭后压力触发不压缩，仅保留 overflow 强制恢复。 */
    autoCompact: boolean;
    /** **重启时清理**开关——默认关（破坏性操作，需显式打开）。
     *
     *  点「重启 DSH」按钮时执行：剥离 assistant stream + 剪裁日志 + 清理备份，
     *  **全库所有会话**。关掉则只重启不清理。
     *
     *  为什么只在重启时做：重启间隙是**唯一全局静默窗口**（dsh 已停，没有会话
     *  在写），也是**唯一能把磁盘收益转成内存收益的窗口**——清理后 dsh 从小日志
     *  重载，撑内存的那个会话重载后加载的事件数直接变少。启动清理（跑在 dsh
     *  进程内，剪的是磁盘，内存里的 `Session.events` 一份没少——对内存恒无效）
     *  与会话关闭即剪（不到重启进不了内存）均已退役（2026-09-20 一帆定）。 */
    restartCleanupEnabled: boolean;
    /** 剪裁深度：**0 = 不剪裁**（只剥离录像）；≥3 = 至少保留最近 N 轮。
     *
     *  为什么默认 0：剪裁有损（丢历史），默认只做无损的 stream 剥离——想瘦身
     *  到底再显式设 N。为什么 ≥3 下界：防误设 1 后「历史怎么没了」。
     *  实际保留可能多于 N——剪裁点只能落在压缩锚点上（只保证下限）。 */
    cleanupPruneTurns: number;
    /** 每会话备份保留份数：**0 = 不设上限**（保留全部）；≥1 = 保留最近 N 份。
     *
     *  **备份恒开**——不存在「不备份」选项（兜底还原必须有备份可回滚，关掉即
     *  与官方验证兜底还原直接冲突）。本字段只管「清理后留多少份」。 */
    backupKeepCount: number;
    /** 未必记忆设置页是否显示「重启 DSH」按钮（默认关）。 */
    restartButtonVisible: boolean;
    /** 🐾 浮窗活动指示器开关（**默认开**——2026-10-14 一帆定）。
     *
     *  开 = 🐾 图标上播放三类动画（读外扩 / 写内收 / 压对折），让用户看见
     *  引擎在干什么（十个 mbsf_* 工具与 γ 压缩默认完全不可见）。
     *  关 = 图标静止（纯视觉偏好，不影响引擎行为——投影照常折叠，只是
     *  UI 不渲染动画）。 */
    activityIndicatorEnabled: boolean;
    /** 🐾 浮窗活动**文字**开关（**默认开**——2026-10-14 一帆定）。
     *
     *  开 = 在 🐾 图标旁显示当前动作文案（「回忆中…」/「走链中…」/「压缩中…」）。
     *  关 = 不显示文字。
     *
     *  与 `activityIndicatorEnabled` **完全独立**（2026-10-14 一帆「一个开关单独
     *  控制动画，一个开关单独控制文字提示」）：动画回答「有没有在动」，文字回答
     *  「在动什么」——两者可任意组合（只看动画 / 只看文字 / 都看 / 都不看）。
     *  同为纯视觉偏好，不影响引擎行为。 */
    activityLabelEnabled: boolean;
    /** **剥离时保留最近 N 条** stream（默认 200）。
     *
     *  `assistant/message.stream` 是模型逐字打字录像（每个 delta + 到达时间），
     *  是日志里最大的单项（实测占单会话 70–82%）。它**只**服务「首字延迟 TTFT」
     *  这类诊断指标——模型可见历史取自 `message.content`，与 stream 无关。
     *
     *  剥离 = 把 `stream` 换成 `[]`（**不能删字段**：DSH 读侧
     *  `assertAssistantSettlementShape` 要求 `Array.isArray(data.stream)`，缺字段
     *  直接抛错；空数组合法，且 `expandAssistantStream([])` → `[]` 让一致性校验
     *  直接 continue）。剥离前自动备份，可回滚。
     *
     *  为什么不是全剥：TTFT 诊断只在「刚这条怎么这么慢」时看——看的是最近几条。
     *  实测收益差极小（全剥 −82.1% vs 保留 200 条 −80.9%，差 1.2pp），
     *  但保留 200 条能在重启后继续查最近几十轮的延迟。0 = 全剥。 */
    sessionStreamKeepCount: number;
    /** **DSH 进程的 V8 old-space 上限**（MB）——「重启 DSH」起 dsh 时注入
     *  `--max-old-space-size=N`。**0 = 不注入**（尊重 node 默认，本机实测
     *  heap_size_limit ≈ 4.2GB）。
     *
     *  为什么需要：dsh 加载会话归档 + 脑索引时峰值数 GB，node 默认上限撑不住
     *  → OOM abort 崩溃史（2026-08-31 三次 .ips 均 FatalProcessOutOfMemory）。
     *  **堆上限必须在进程启动前定**（`v8.setFlagsFromString` 对
     *  `--max-old-space-size` 无效）⟹ 唯一注入窗口 = 重启间隙（runner spawn
     *  dsh 那一刻）。
     *
     *  默认 8192（16GB 机器的一半）；合法域 = **0 或 ≥ 4096**（低于 node 默认
     *  无意义——注入更小的值只会让 OOM 提前；同 cleanupPruneTurns 的
     *  「0 或 ≥3」先例）。上界由物理内存算出（`resolveDshHeapMaxMb`——留出
     *  系统保留）。 */
    dshHeapMb: number;
    /** **缓存自动释放**开关——默认关（2026-09-27 一帆定：首次引入自动行为，
     *  先手动开、观察实测效果再考虑改默认）。
     *
     *  开 = 引擎每 2 分钟 tick 一次，**仅在真闲时**（无在途 mbsf 调用 ∧ 阶段
     *  空闲）且堆占用超阈值 → 调 `reclaimMemory()` 清派生缓存。
     *
     *  为什么必须「真闲才清」：被清的缓存（archLabelInv / labelToks / fragToks…）
     *  全是**按需惰性重建**——忙时清，下一个 recall 立刻长回来（代价白付，还给
     *  热路径添一次重建延迟）。空闲窗口清 = 没有 recall 来重建 ⟹ 收益真留住。
     *  忙 → 本轮跳过，下个 tick 再看，**永不打断热路径**。
     *
     *  释放**不碰**数据本体（`_index`/`_inv`）⟹ 不丢数据、不改召回结果
     *  （正确性已验收：清理前后 5 组查询逐字节一致）。唯一代价 = 清后首次
     *  recall 有一次可感知变慢。 */
    autoReclaimEnabled: boolean;
    /** 自动释放的堆占用阈值（**百分比**，默认 60）。
     *
     *  为什么用百分比而不是绝对值 MB：App（Electron）形态 `heap_size_limit`
     *  实测 4192MB，而 `dshHeapMb` 配的 10240MB **在该形态下不生效**——同一个
     *  绝对值在 App / CLI 两种形态下压力完全不同。百分比按**真实**堆上限
     *  （`v8.getHeapStatistics().heap_size_limit`）算，跨形态自适配。
     *
     *  合法域 20–95（`AUTO_RECLAIM_PCT_MIN` / `MAX`）：下界防「一启动就清」，
     *  上界留安全余量（100% = 已经 OOM 了，来不及清）。 */
    autoReclaimThresholdPct: number;
    /** 压缩 tail 近因窗口（条，8–256，默认 64；会话级可覆盖）。
     *  `structuralTailStart` 的兜底上限——N 越大越容易让「闭合边界」被采用，
     *  N ≥ 当前消息数时该会话不压缩（见 COMPACT_TAIL_MESSAGES_* 注释）。 */
    compactTailMessages: number;
}
/** 保留回合数的下界（2026-09-10 一帆定：设成 3，防误设 1 后「历史怎么没了」）。
 *  [OBS] UI 输入护栏（防误操作，不是内容常数）——不参与任何引擎判定。 */
export declare const SESSION_RESET_MIN_TURNS_FLOOR = 3;
/** 压缩 tail 近因窗口（条）的范围与默认值（2026-11-08 一帆定：8–256）。
 *  工程值——N 是窗口参数（非结构量），无明确依据。
 *  `tailStart = max(chainHead, len − N)`：
 *   N 越大 → `len − N` 越小 → 结构边界 chainHead 越容易被采用；
 *   但 chainHead 从未靠后时（无闭合），`len − N` 变小只是让 tail 保留更多；
 *   当 **N ≥ 当前消息数** 时 `len − N ≤ 0` ⟹ tailStart 退化为 chainHead
 *   （无闭合则 0）⟹ 该会话**不压缩**（静默失效——UI 需提示）。 */
export declare const COMPACT_TAIL_MESSAGES_MIN = 8;
export declare const COMPACT_TAIL_MESSAGES_MAX = 256;
export declare const COMPACT_TAIL_MESSAGES_DEFAULT = 64;
/** 把任意输入钳到合法 tail 窗口（8–256，整数）。 */
export declare function clampTailMessages(value: unknown): number;
/** 重启清理的默认保留回合数（UI 标「★ 推荐」值——原自动重置的默认底线）。
 *  [OBS] UI 推荐值（只是输入框预填）——与 `SESSION_RESET_MIN_TURNS` 同源，
 *  用户可改；不进判定层。 */
export declare const CLEANUP_PRUNE_TURNS_RECOMMENDED = 10;
/** 备份保留份数的默认值（UI 标「★ 推荐」值——原实现硬编码值）。
 *  [OBS] UI 推荐值 + 磁盘护栏（备份体积大，3 份 ≈ 覆盖最近三次危险操作）。 */
export declare const BACKUP_KEEP_COUNT_DEFAULT = 3;
/** DSH 堆上限默认值（MB）——16GB 机器的一半（与 dsh-web 启动器的
 *  DEFAULT_HEAP_MB 同值——两条启动路径的默认必须一致）。 */
/** [OBS] 物理资源参照（本机 16GB 的一半）——**外部约束值不是内容常数**：必须与
 *  dsh-web 启动器的 `DEFAULT_HEAP_MB` 一致（两条启动路径默认不同 = 用户换个入口
 *  就崩，2026-11-01 事故即此类）。不进判定层。 */
export declare const DSH_HEAP_DEFAULT_MB = 8192;
/** 堆上限的合法下界（MB）——低于 node 默认（本机实测 4288）无意义。
 *  [OBS] 物理资源护栏——V8 老生代下限，低于它设了也等于没设。 */
export declare const DSH_HEAP_MIN_MB = 4096;
/** 自动释放阈值的合法下界（%）——防「一启动就清」（启动窗口缓存在建，清了必白清）。
 *  [OBS] UI 输入护栏——启动路径实测只到 ~1.2GB（initMemoryIndex 586MB +
 *  prewarm 1222MB），20% × 4192 ≈ 838MB 恰好在其下 ⟹ 不会白清。 */
export declare const AUTO_RECLAIM_PCT_MIN = 20;
/** 自动释放阈值的合法上界（%）——留安全余量（100% = 已经 OOM，来不及清）。
 *  [OBS] UI 输入护栏——⚠️ **注意分母不可靠**：实测 V8 在 ~3050MB（名义 4192MB
 *  的 73%）就 `last resort` ⟹ 高百分比区间实际不可用（见 `EMERGENCY_PCT` 注释）。 */
export declare const AUTO_RECLAIM_PCT_MAX = 95;
/** 自动释放阈值的默认值（%）——60% 时清一次，兼顾「别太频繁」与「别到 OOM 才动」。
 *  [OBS] 与 `EMERGENCY_PCT`（65%）同量级但**语义不同**：60% = 常规路径阈值
 *  （还要等 `isIdle()`），65% = 紧急路径阈值（不等空闲）。60% × 4192 ≈ 2515MB，
 *  比最低死亡点 3022.7MB 低 508MB ⟹ 常规路径理论上先于紧急路径触发。 */
export declare const AUTO_RECLAIM_PCT_DEFAULT = 60;
/** 系统保留内存（MB）——算上限时从物理内存里扣掉（macOS 系统 + 浏览器
 *  + 其他应用）。
 *  [OBS] 物理资源参照（6GB 经验值）——16GB 机器 → 上限 16−6 = 10GB，
 *  再向下取整到 GB。外部约束值，不进判定层。 */
export declare const DSH_HEAP_RESERVE_MB = 6144;
/** 本机允许的最大堆上限（MB）——物理内存 − 系统保留，向下取整到 GB，
 *  下界 4096。
 *
 *  **为什么用 totalmem 而非 freemem**：macOS 把空闲内存尽量用作文件缓存，
 *  freemem 实测只有 88MB（用它算上限会得到 0）。物理总量才是真边界。 */
export declare function resolveDshHeapMaxMb(): number;
/** 堆上限合法域钳制：0（不注入）或 ≥ 4096（取整到 1024）。
 *  同 normalizeCleanupPruneTurns 的「0 或 ≥N」形态（UI 滑块拖进空洞时用）。 */
export declare function normalizeDshHeapMb(value: number): number;
/** 崩溃快照目录（`--diagnostic-dir` 指向它）。**必须在起 dsh 前建好**——
 *  V8 不会自建（实测：目录不存在时快照静默丢失）。 */
export declare function heapSnapshotDir(): string;
/**
 * 把堆配置注入 execArgv（重启 dsh 用）。
 *
 * 规则：
 *  - `dshHeapMb <= 0` → 原样返回（不注入，尊重 node 默认）
 *  - 已含 `--max-old-space-size` → 原样返回（尊重显式配置，同 dsh-web 先例）
 *  - 否则追加 `--max-old-space-size=N` + `--heapsnapshot-near-heap-limit=1`
 *    + `--diagnostic-dir=<快照目录>`
 *
 *  **为什么连 heapsnapshot 一起注入**：接近上限时 V8 自动 dump 堆快照——
 *  下次 OOM 崩了有确凿证据（当前 3.6G/4.28G 余量只剩 600MB，需要证据链）。
 *
 *  **为什么必须带 diagnostic-dir**：`--heapsnapshot-near-heap-limit` 默认
 *  把快照写进 **cwd**——dsh 的 cwd 是 `/Users/ai/deepseek-harness`，一次
 *  268MB 的快照会污染 dsh 检出（实测确认）。指向 `~/.mbsf/heap-snapshots/`
 *  才是对的落点。
 *
 * @param execArgv - 原 execArgv（不改原数组）。
 * @returns 注入后的新数组。
 */
export declare function withDshHeapFlags(execArgv: readonly string[]): string[];
/** 确保快照目录存在（起 dsh 前调用——V8 不自建）。 */
export declare function ensureHeapSnapshotDir(): void;
/** 脑数据目录（与 mbsfSummarize 同一解析：env 覆盖，默认 ~/.mbsf）。 */
export declare function resolveMbsfDataDir(): string;
/** 加载（首次）或返回缓存的运行时配置；config.json 覆盖 env 默认。 */
export declare function loadRuntimeConfig(): MbsfRuntimeConfig;
/** 当前运行时配置（惰性加载）。 */
export declare function getRuntimeConfig(): MbsfRuntimeConfig;
/**
 * 应用部分配置变更：更新内存单例 + 合并落盘 config.json。
 * @param partial - 变更字段（undefined 字段忽略）。
 * @returns 应用后的完整配置（副本）。
 */
export declare function setRuntimeConfig(partial: Partial<MbsfRuntimeConfig>): MbsfRuntimeConfig;
