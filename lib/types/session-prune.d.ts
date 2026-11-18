/**
 * 会话日志瘦身（γ-prune）——方案 B'：尾部帧提取 + 内联修复 + CLEAN 验证
 *
 * DSH 的会话日志（`~/.dsh/sessions/<workspace>/session-<id>/session.jsonl` 或
 * `.jsonl.zstd`）是纯追加的：compaction 每折叠一段历史，就把被折叠的
 * 原文永远留在文件里。日志无限增长（实测一条长会话可到 116MB+ / 数百万
 * 事件），而 checkpoint 已经完整代表了被折叠历史——被 shadow 的原文对
 * 恢复毫无用处。
 *
 * 本模块在**行级**裁剪：把文件重写为「最后一个完整 compaction 段及其后
 * 的全部事件」（checkpoint 代表历史，后续事件照旧），被 shadow 的旧帧
 * 全部丢弃。裁剪后重放的会话面与裁剪前完全一致（checkpoint 归一为
 * append 语义，代表消息不变），文件物理变小，DSH 读侧是 layout-blind
 * 的（逐帧解压 + 逐行解析），无需任何改动。
 *
 * 为什么是 B' 而不是旧 A 方案（findLastCheckpointFrameIndex 全量解码 +
 * foldSurface 验证，2026-08-28 审视淘汰）：
 *  - **内存**：旧方案全量解码，116MB zstd 日志解码峰值 844MB；B' 从后
 *    往前逐帧反向扫描，找到锚点即停，峰值 ~12MB（只保留尾部增量）。
 *  - **锚点可达**：旧方案要求「同帧 start/end 配对 + 帧内含 summary +
 *    replace checkpoint」——真实日志里 compaction start/end 几乎总跨帧
 *    （写入批次边界），同帧配对要求导致锚点回退到极早帧（tail≈全文件）；
 *    B' 锚点 = 最后一个无 error 的 compaction/start（其后跨帧累积已见
 *    无 error 的 compaction/end），行级切分（从 start 事件行起），不要求
 *    summary/checkpoint 在场。
 *  - **验证哲学**：旧方案「有 violation 即拒绝」——9ffe 尾部天然带 2 个
 *    step 配对缺口（跨锚点 step/start 被剪），大文件永远剪不了；B'
 *    裁剪后**内联修复**（补插 step/start）再验证 CLEAN，不拒绝。
 *  - **chunk 行保护**：repairStepStarts 的 `event.seq = index` 无条件重
 *    编号会破坏 chunk 打包行的语义（text-chunks 等物理行 envelope 只有
 *    seq0/time0/data，没有 seq 字段——加了 seq 字段即破坏 DSH 打包格式）；
 *    B' 内联修复只重编号消息级 seq + 平移 chunk 行 seq0，chunk 行不加
 *    seq 字段。
 *
 * 裁剪安全设计（对齐 session-health）：
 *  - 三重验证全部通过才写盘：① step 配对 CLEAN（detectStepViolations）；
 *    ② v3 decodeRow 展开 + seq 连续 + foldSurface 重放（与 DSH
 *    读侧 SessionLogScanner 的加载校验同构）；③ 编码读回一致性（产物
 *    重读逐事件深比较）。
 *  - 备份原日志（默认开）到 `prune-backups/`（脑数据目录内，不参与再扫描）；
 *  - 临时文件 + fsync + 原子 rename（POSIX），绝不写坏原文件；
 *  - 扫描层 mtime 防线：只处理 mtime 早于 minAgeMs 的日志（排除活跃
 *    会话——活跃会话可能正在写尾部，裁剪会丢事件），由调用方传入
 *    （引擎启动扫描传 1 小时）。
 *  - **状态类事件保留**（2026-09-10 一帆「裁的时候保留状态类事件，
 *    否则 resume 后 goal 会丢」）：裁剪只丢「被 checkpoint 代表的材料」，
 *    不丢「当前状态」——状态不是历史，是当前值。goal/change ·
 *    todo/write · plan/mode · permission/preset · sandbox/mode ·
 *    approval/policy · session/title 全量保留并插入锚点段之后（先于尾部
 *    较新的同类型事件，fold 顺序正确）。新增状态类事件类型必须登记进
 *    STATE_EVENT_TYPES，否则裁剪会静默丢状态。
 *
 * @module mbsf-compaction/session-prune
 */
/** 一个会话日志事件（JSONL 行解析后的对象；未知字段原样保留）。 */
export interface PruneEvent {
    type: string;
    seq: number;
    data?: Record<string, unknown>;
    surfaceOp?: unknown;
    sourceEventSeqs?: number[];
    [key: string]: unknown;
}
/** 解析后的会话日志。 */
export interface DecodedSessionLog {
    /** header 帧/首行解析出的对象（重写时原样序列化）。 */
    header: Record<string, unknown>;
    /** 全部事件（seq 0 起连续，与 DSH 写入一致）。 */
    events: PruneEvent[];
    /** 该日志是否为 zstd 压缩（否则为 plaintext）。 */
    zstd: boolean;
}
/** 一次成功的瘦身结果。 */
export interface PruneOutcome {
    /** 被瘦身的日志绝对路径。 */
    path: string;
    /** 瘦身前物理字节数。 */
    beforeBytes: number;
    /** 瘦身后物理字节数。 */
    afterBytes: number;
    /** 保留事件数（重编号后，含补插的 step）。 */
    keptEvents: number;
    /** 提取尾部的原始行数（裁剪前；不含补插）。 */
    tailRows: number;
    /** 补插的 step/start 数（修复配对缺口）。 */
    insertedSteps: number;
    /** 从被裁前缀中抢救回来的状态类事件数（goal/change · todo/write 等）。 */
    keptStateRows: number;
    /** 裁剪锚点：compaction/start 事件的原始 seq（重编号前）。 */
    checkpointStartSeq: number;
}
/** 一个结构完整的 zstd 帧的字节范围（含起点、不含终点）。 */
export interface ZstdFrameRange {
    start: number;
    end: number;
}
/** 结构扫描结果：完整帧 + 可选的未完成末帧起点。 */
export interface ZstdFrameScan {
    frames: ZstdFrameRange[];
    tornStart?: number;
}
/**
 * 结构扫描拼接 zstd 流：读帧头描述符 + 逐块块头定位完整帧，不依赖魔数
 * 搜索（压缩内容里出现的魔数序列不会误切帧），与 DSH 写入侧的
 * scanZstdFrames 同构。EOF 落在某帧内部时返回该帧起点作为 tornStart。
 */
export declare function scanZstdFrames(buffer: Buffer): ZstdFrameScan;
/**
 * 解码完整日志：zstd 模式按结构扫描逐帧解压拼接后按行解析；plaintext
 * 模式直接按行解析。完整帧内的记录必须以换行收尾（写侧保证），否则视为
 * 半个 JSONL 记录抛错；结构不完整的末帧只恢复以换行收尾的完整行（半行
 * 丢弃——与 DSH torn-tail 语义一致），不可恢复则跳过。解析失败抛错
 * （调用方捕获后跳过）。
 */
export declare function decodeSessionLog(buffer: Buffer, zstd: boolean): DecodedSessionLog;
/**
 * 编码裁剪后的日志为 DSH 兼容字节：**header 一帧 + 每行一帧**。
 *
 * ## ⚠️ 分帧方式是与 App 读侧的**物理契约**（2026-10-02 事故根因）
 *
 * 曾经这里把**整个 body 压成 1 帧**（header 帧 + body 帧 = 共 2 帧）。注释当时
 * 写的是「header 帧 + 单事件帧」，**代码与注释不符**，而后果直到用户打开会话
 * 才暴露：2026-10-02 21:55 那次清理把 9 个会话剪成 2 帧产物，
 * App 侧**读不出内容**（会话列表点开是空的），而 `cleanup-stats.json` 里
 * `failed: 0, restored: 0` —— **零报错**。
 *
 * 为什么 2 帧会坏：App 的 `readZstdPrefix` / `decodeCurrentGeneration` 按
 * **帧边界**做增量读取（append-only 语义——每帧是一个可独立解出的物理块），
 * 并把**首帧**当作独立 header 校验（`assertIndependentHeaderFrame`）。
 * 单帧大块破坏了「帧 = 增量单位」这一前提。
 *
 * **实测对照**（2026-10-02）：
 *  · 健康原件：13,147 帧（一行一帧）；
 *  · 剪坏产物：**2 帧** ⟹ 会话打不开。
 *
 * 故此处**必须逐行成帧**。压缩比会略降（每帧有约 9 字节帧头），
 * 但这是正确性代价，不可省。
 */
export declare function encodeSessionLog(header: Record<string, unknown>, events: readonly PruneEvent[], zstd: boolean): Buffer;
/**
 * token meter 规则的 step 配对检测：返回违规事件 seq 列表。
 *
 * 规则（与 token meter `_foldEvent` 逐条对齐，2026-09-26 补 START_WHILE_OPEN）：
 *  - assistant/message 与 step/end 必须落在「当前打开的 step/start 的同
 *    turn/step」内；step/end 闭合后 open 清空；
 *  - **step/start 到达时 open 必须为空**——未闭合就开下一个 = 违规
 *    （token meter 抛 "step/start ... arrived before turn X/step Y ended"）。
 *    2026-09-26 修复：旧实现直接覆盖 open，漏检此形态；剪裁管线产出的
 *    孤儿 step/start（6b6d48c3/a287c0b1/7a66a93c 三例）因此通过三重验证
 *    写盘，token meter 重放抛错 → 会话压缩全面停摆 → 上下文爆表 400。
 *  - chunk 打包行（text-chunks 等物理行）不参与配对。
 * 只读检测——B' 裁剪后先 repair 再验证 CLEAN。
 */
export declare function detectStepViolations(events: readonly PruneEvent[]): number[];
/** 行级尾部提取结果。 */
interface TailExtract {
    /** header 对象（首个 session 行）。 */
    header: Record<string, unknown>;
    /** 锚点 compaction/start 行（含）之后的全部事件行（原样字符串）。 */
    rows: string[];
    /** 锚点 compaction/start 事件的原始 seq（重编号前）。 */
    anchorSeq: number;
}
/**
 * 收集原日志开头的完整 turn 骨架（turn/start → step/start → system/message → step/end → turn/end）。
 *
 * 剪裁只保留尾部时这段会被丢掉，产物再无 system/message ⟹ DSH 新版读侧报
 * `system/message requires a protected first surface head` / `step/start does not match
 * the open turn and next step`（2026-11-17 事故：两个会话打不开）。这里把它捞回来，
 * 作为产物的 turn 1。
 */
export declare function collectHeadRows(buffer: Buffer, zstd: boolean): string[];
/**
 * 把尾部行的 turn 编号整体重排为从 `startTurn` 起的连续编号（按首次出现顺序）。
 *
 * 剪裁产物里 head 占 turn 1，尾部必须从 turn 2 开始且连续——否则 DSH 的
 * `turn/start does not open the expected turn` 立刻拒绝。
 */
export declare function renumberTurns(rows: readonly string[], startTurn: number): string[];
export declare function extractTailRows(buffer: Buffer, zstd: boolean, minTurns?: number): TailExtract | undefined;
/**
 * `repairPrunedTail` 的收窄判据选项（2026-09-25 新增——修 400 事故）。
 *
 * `finalSurface` = **全量 fold 的最终表面**（旧 seq 集合），由
 * {@link collectPreAnchorRows} 在同一次扫描里产出。它是「原文可见性」的
 * 权威判据：
 *  - 节点旧 seq ∈ finalSurface ⟹ 原文里可见（**不可被阴影**——吞掉它 =
 *    表面丢内容）；
 *  - 节点旧 seq ∉ finalSurface ⟹ 原文里已被折叠（**应被阴影**——留在表面 =
 *    表面爆炸，实测 6b6d48c3 从 170 节点炸到 3338 节点 / 109k → 4.8M
 *    est-tokens，DSH 读侧 400）。
 *
 * 不传时退化为保守行为（所有 replace 归一 append——旧实现语义，仅供
 * 旧调用方/测试使用；生产路径恒传）。
 */
export interface RepairPrunedTailOptions {
    /** 全量 fold 的最终表面（**旧 seq** 集合）。 */
    finalSurface?: ReadonlySet<number>;
}
/**
 * B' 内联修复：对提取尾部行执行
 *  1. step 配对修复——在违规的 assistant/message 或 step/end 前补插
 *     step/end（闭合旧 step）+ step/start（打开新 step）；
 *  2. 逻辑 seq 重编号 0 起连续——消息级 seq = 计数器++；chunk 行
 *     seq0 = 计数器（成员按 texts/args 长度推进计数器）。**chunk 行不
 *     添加 seq 字段**（DSH 打包格式 envelope 只有 seq0/time0/data，加
 *     seq 字段即破坏 validateRow 的 hasExactKeys 校验）；
 *  3. 引用重映射——sourceEventSeqs / data.shadowedSeqs / data.shadowedRange
 *     按旧→新 seq 映射表平移；映射不到（引用被裁历史）= 坏引用保留原值
 *     （两字段永不删——见下注释），空则删字段；
 *  3b. **影子价格同步**（2026-09-26 新增）：收窄 / 后置覆盖 pass 重算
 *     checkpoint 的 replace 区间后，把结果回写到其 `compactionId` 对应
 *     summary 的 `shadowedRange`/`shadowedSeqs`/`shadowedTokenCount`——
 *     否则 token-meter 的 `foldSurfaceProjection` 契约（claim 区间必须 =
 *     紧邻 replace 区间）被违反，整条日志在 GUI 读侧抛错不可加载；
 *  4. surfaceOp replace **收窄**（2026-09-25 修订——取代旧「无条件归一
 *     append」）：被折叠区间随裁剪消失后，checkpoint 的 replace 区间按
 *     「存活阴影节点的表面跨度」重算——存活非空 → 保留 replace（区间 =
 *     表面位置上首末存活节点；`sourceEventSeqs` 同步 = 跨度内全部节点，
 *     满足宿主 `assertProvenance` 的「必须含每个阴影节点」）；存活为空 →
 *     归一 append。**障碍保护**：跨度内若含「原文可见」节点（旧 seq ∈
 *     finalSurface）→ 收缩到不含可见节点的单侧连续段，绝不吞可见内容。
 *  5. **后置覆盖 pass**（2026-09-25 新增）：主 pass 结束后，表面上仍残留
 *     「原文不可见」（旧 seq ∉ finalSurface）的节点（典型 = 救援注入的
 *     goal 轮次行——阴影它们的 op 在锚点之前、已随裁剪消失）→ 由锚点段
 *     checkpoint 承担覆盖（区间 = 残留节点的连续跨度；约束 = 跨度内不得
 *     含可见节点，否则收缩到安全子段）。
 *
 * 不修改调用方行数组（新分配事件对象）。返回修复后事件与补插数。
 */
/**
 * 把「seq 引用列表」打平成**扁平的非负整数数组**（2026-10-03 补）。
 *
 * **为什么必须做**：DSH 的 `assertSourceEventReferences` 要求
 * `sourceEventSeqs` 是扁平的非负安全整数数组：
 *   `session event "<type>" sourceEventSeqs must densely contain
 *    non-negative safe integers`
 * 嵌套元素（如 `[587, [589, 591], 592]`）直接判非法 ⟹ `foldSurface` 抛错
 * ⟹ **会话投影不出任何消息** ⟹ 界面「有列表、点开是空的」。
 *
 * 历史产物里确有此类嵌套（实测 -232c-49 19 处 / 293c2740 1 处）——它经
 * `shadowedSeqs` → `summaryShadow` → `span` → `sourceEventSeqs` 自我
 * 强化传播。本函数是**兜底打平**，与 `shadowCandidates` 源头打平配套。
 *
 * 打平语义：递归展开、只保留非负安全整数、去重、升序（升序是 DSH 的
 * `densely` 契约所要求的形态）。
 */
export declare function flatSeqs(value: unknown): number[];
export declare function repairPrunedTail(rows: readonly string[], options?: RepairPrunedTailOptions): {
    events: PruneEvent[];
    inserted: number;
};
/**
 * 【0.3 · 2026-09-27】系统提示头保护检查（与 DSH `assertSystemHeadRewrite` 对齐）。
 *
 * DSH 读侧（app.asar `planSurfaceEvent` → `assertSystemHeadRewrite`）规则：
 * 表面第 0 个节点若是 `system/message`，则任何 replace 若**以该节点为起点**
 * 且不是「一个 `system/message` 只覆盖该单节点」→ 抛
 * `surface replace: node 0 holds the system prompt ...`。
 *
 * 返回 true = 无违规（可落盘）；返回 false = 存在违规（拒绝该产物）。
 * （⚠️ 名字沿 `hasForwardRefs` 的语义——「检查通过」返回 true，非「有违规」。）
 *
 * 与 `hasForwardRefs` 同为「验证判据必须覆盖读侧判据」的落地——历史教训：
 * 判据落后于读侧 ⟹ 本地三重验证通过、DSH 侧炸（本文件 1886-1940 注释）。
 *
 * 导出仅供单测直接打靶（判据本体不该只能通过整条管线间接测）。
 */
export declare function hasSystemHeadViolation(events: readonly PruneEvent[]): boolean;
/**
 * 【产物形态 C · 2026-09-27】把裁剪产物改造成「合法独立会话」。
 *
 * **为什么必须做**：B′ 产物强制以 `compaction/start` 开头（见 `verifyPrunedTail`
 * 第 0 条），但 DSH v3→v4 的 `span()` 要求 `shadowedRange` 端点**严格早于**
 * summary 自身 seq 且在**当前 surface** 上。锚点帧的 summary 位于 seq=1，
 * 之前没有任何 surface 事件 ⟹ **结构上永远非法**
 * （实测报 `compaction range start must name an earlier event`；
 * 全库 28 个裁剪产物 **0 个**通过迁移）。
 *
 * **两条契约互斥，只能改产物形态**。做法：
 *  1. 删除全部 `compaction/start|summary|end`——**摘要正文不丢**：实测每个
 *     summary 的文本都已完整内嵌在同帧 checkpoint 的 `<compacted-summary>`
 *     块里（逐帧核对 8/8 命中）；
 *  2. checkpoint 的 replace 区间随阴影节点消失 → 归一 `append`；
 *  3. 删掉悬空的 `source.compactionId`（`plugin` 必须保留——它是生产者身份，
 *     `rewritePluginSource` 要求其为 string）；
 *  4. 删掉孤立的 `turn/end`（其 `turn/start` 落在被裁前缀里）；
 *  5. turn 编号重排为 `1..N`（DSH 要求首个 `turn/start` 的 turn === nextTurn(1)）；
 *  6. 预筛删除「无法合法引用 human user/message」的非 user `session/title`；
 *  7. seq 重编号 + 全引用重映射（含 surfaceOp 端点）。
 *
 * @param events - `repairPrunedTail` 的输出（seq 已 0 起连续）。
 * @returns 改造后的事件（可被 DSH v3→v4 迁移接受）。
 */
export declare function normalizeCompactArtifact(events: readonly PruneEvent[]): PruneEvent[];
export declare function verifyPrunedTail(header: Record<string, unknown>, events: readonly PruneEvent[], zstd: boolean): boolean;
/**
 * 一遍扫描全文的产物（2026-09-25 新增——取代旧 `shadowRescuedGoalRounds`）。
 *
 * **为什么需要**：裁剪只保留「锚点行及其后」，但两件事要求我们从被裁前缀里
 * 捞回东西：
 *  1. **原文可见性判据**（`finalSurface`）——`repairPrunedTail` 的收窄/覆盖
 *     pass 要区分「原文里可见的节点」（不可阴影）与「原文里已被折叠的节点」
 *     （应阴影）。判据 = **全量 fold 的最终表面**（旧 seq 集合）。
 *     ⚠️ 不能用 summary 的 `shadowedSeqs` 并集代替：剪裁历史里 remap 失败
 *     的条目会**保留原值不动**（见 `repairPrunedTail` 的「两字段永不删」
 *     注释），形成大量假阳性（实测 7a66a93c 的 sh 并集含 25 个实际可见的
 *     节点，直接用会让收窄误吞真实内容）。
 *  2. **锚点前存活行**——锚点之前仍可能有一批「原文里可见」的消息行
 *     （典型 = 最后一个 checkpoint 的 replace 之后、锚点 start 之前的事件，
 *     如 1568d895 的 seq 6902..6936）。旧实现只捞状态行，这些存活行直接
 *     丢失（实测：产物表面比原文少 15 个节点）。
 *
 * 返回：
 *  - `finalSurface`：全量 fold 的最终表面（旧 seq 集合）。
 *  - `insertRows`：应插到锚点段之前的行（按旧 seq 升序）——= 锚点前的
 *    「原文可见行」（旧 seq ∈ finalSurface）∪「状态行」（救援语义：goal
 *    fold / inbox 重放需要）。**救援行插入锚点段之前**（而不是之后）很关键：
 *    这样锚点段 checkpoint 的收窄/覆盖 pass 能把「原文里被折叠、仅因救援
 *    而注入」的轮次行重新阴影掉（保持表面与原文一致），而不是让它们
 *    append 到表面尾部（时间倒流）。
 */
export interface PreAnchorRows {
    /** 全量 fold 的最终表面（**旧 seq** 集合）。 */
    finalSurface: Set<number>;
    /** 应插到锚点段之前的行（旧 seq 升序）。 */
    insertRows: {
        seq: number;
        line: string;
    }[];
}
/**
 * 扫描全文收集 {@link PreAnchorRows}。逐帧解压（峰值 = 单帧明文），与
 * `extractStateRows` 同一内存纪律。
 *
 * @param buffer - 日志物理字节。
 * @param zstd - 是否 zstd 压缩。
 * @param anchorSeq - 裁剪锚点（compaction/start 的原始 seq）——只收集
 *                    **锚点之前**的行。
 */
export declare function collectPreAnchorRows(buffer: Buffer, zstd: boolean, anchorSeq: number): PreAnchorRows;
/**
 * 状态类事件类型——裁剪必须保留。这些事件的语义是「当前状态的一次变更」，
 * 由 DSH 各插件在 resume 时**按序 fold** 重建状态（goal/todo/plan/权限/
 * 标题）；被裁掉不等于被 checkpoint 代表（checkpoint 只代表对话材料），
 * 丢了它们 resume 后状态直接消失。
 *
 * 维护契约：新增状态类事件类型（任何「fold 出当前值」的事件）必须登记
 * 到这里，否则瘦身会静默丢状态；**类型白名单之外还有按字段判定的状态载体**
 * （`isFoldStateRow`），两者合起来才是完整的「裁剪必须保留」集合。
 */
export declare const STATE_EVENT_TYPES: ReadonlySet<string>;
/**
 * 收集**整份日志**里的状态类事件原始行（裁剪会把它们所在的前缀丢掉，所以
 * 必须从全文捞回来）。逐帧解压，峰值 = 单帧明文（不整线驻留——与锚点提取
 * 同一条内存纪律）。torn 尾帧按 DSH 口径恢复完整行后一并收集。
 */
export declare function extractStateRows(buffer: Buffer, zstd: boolean): string[];
/**
 * 把抢救回来的状态类行合并进尾部行：按 seq 去重（尾部已有的不重复注入），
 * 插入点 = 首个 compaction/end 之后（锚点段闭合处）——这样注入的旧状态
 * 事件先于尾部中较新的同类型事件，fold 出来的当前值正确；且产物首行仍是
 * compaction/start（verifyPrunedTail 的产物形态检查）。
 */
export declare function mergeStateRows(rows: readonly string[], stateRows: readonly string[]): string[];
export interface PruneSessionOptions {
    /** 物理字节阈值：日志小于它不处理；0 = 禁用。 */
    thresholdBytes: number;
    /** 解码/裁剪失败时是否吞掉异常（默认 true——瘦身是增强，不阻断启动）。 */
    quiet?: boolean;
    /** 剪裁前是否备份原日志到 backupDir（默认 true——保留原文可回滚）。 */
    backup?: boolean;
    /** 备份目录（默认 `<脑数据目录>/prune-backups/`，在会话目录之外，
     *  不会被再次扫描）。 */
    backupDir?: string;
    /** 产物是否必须带 system/message（protected head）。默认 true；单测合成日志可传 false。 */
    requireHead?: boolean;
    /** 锚点底线：产物里至少保留的**完整回合数**（默认 0 = 只用最近锚点）。
     *  2026-09-10：会话内存上限设多小，都至少留最近 N 轮。 */
    minTurns?: number;
    /** **官方验证 + 兜底还原**（默认 false——只有重启清理路径需要）。
     *  见 {@link StreamStripOptions.officialVerify}。 */
    officialVerify?: boolean;
    /** 官方验证的计数累加器（与 officialVerify 配套；跨文件共享）。 */
    officialReport?: OfficialVerifyReport;
}
/**
 * 瘦身单个会话日志文件（B' 路径：尾部帧提取 + 内联修复 + 三重验证）。
 * 安全前置：原文件不动，直到裁剪结果通过 verifyPrunedTail；验证后临时
 * 文件 + fsync + 原子 rename。
 * @returns 成功时返回结果；文件小于阈值 / 无完整 compaction 段 / 验证
 *          失败时返回 undefined（原文件保持原样）。
 */
export declare function pruneSessionFile(path: string, options: PruneSessionOptions): PruneOutcome | undefined;
export interface PruneScanOptions {
    /** 物理字节阈值（同 PruneSessionOptions）。 */
    thresholdBytes: number;
    /** 只处理 mtime 早于 (now - minAgeMs) 的日志——排除活跃/当前会话
     *  （活跃会话可能正在写尾部，裁剪会丢正在写的事件）。 */
    minAgeMs?: number;
    /** 剪裁前是否备份原日志（同 PruneSessionOptions，默认 true）。 */
    backup?: boolean;
    /** 备份目录（同 PruneSessionOptions）。 */
    backupDir?: string;
    /** 锚点底线（同 PruneSessionOptions；默认 0）。 */
    minTurns?: number;
    /** 官方验证 + 兜底还原（同 PruneSessionOptions；默认 false）。 */
    officialVerify?: boolean;
    /** 官方验证计数累加器（跨文件共享）。 */
    officialReport?: OfficialVerifyReport;
    /** 产物是否必须带 protected head（同 PruneSessionOptions，默认 true）。 */
    requireHead?: boolean;
    /** **会话过滤**（2026-11-07 会话历史剪裁）：返回 false 的会话整个跳过。
     *
     *  缺省 = 处理全部会话（全库清理的既有语义，一行不变）。给了就把「全库」
     *  降维成「勾选集合」——过滤发生在**进循环之前**，所以被排除的会话连
     *  stat 都不做，不是「处理了再丢」。
     *  @param sessionId - 会话目录名（DSH 的会话 id）。
     *  @param workspace - 工作区目录名（`--Users-...--` 形态，原样传入）。 */
    sessionFilter?: (sessionId: string, workspace: string) => boolean;
}
export interface PruneScanResult {
    /** 成功瘦身的文件。 */
    pruned: PruneOutcome[];
    /** 因小于阈值 / 无帧 / 验证失败 / 太新而跳过的文件数。 */
    skipped: number;
    /** 释放的总字节数。 */
    freedBytes: number;
}
/**
 * 扫描一个 DSH 会话根目录（`<dshHome>/sessions/<workspace>/session-<id>/`）
 * 下的全部会话日志，逐个瘦身。文件路径形状与 DSH 写入一致：
 * `session.jsonl`（plaintext）或 `session.jsonl.zstd`。
 */
/** 启动全扫的事件循环让行预算（2026-09-14 C 方案）。
 *
 *  背景：重启实测「事件循环阻塞 4391ms」，归因 decodeSessionLog / newlineCount
 *  / writeSync——γ-prune 与健康检查这两个启动全扫是同步大循环，一次性占满
 *  主线程（阶段=空闲，故不伤回合，但 4.4s 是真阻塞）。
 *  修法：每积累约 SCAN_YIELD_BUDGET_MS 工作量让出一次事件循环，把一次长阻塞
 *  摊成若干小突发——扫描逻辑/顺序/产物完全不变。 */
/** [OBS] 让行预算（20ms——**可感知卡顿的下界**）：启动全扫实测 4.4s 真阻塞，
 *  每积累约 20ms 工作量让出一次事件循环，把一次长阻塞摊成若干小突发。
 *  扫描逻辑/顺序/产物**完全不变**（只是调度切片）⟹ 不进判定层。 */
export declare const SCAN_YIELD_BUDGET_MS = 20;
/** 让行（见 SCAN_YIELD_BUDGET_MS）。budget 由调用方持有、跨文件累计。 */
export declare function yieldToEventLoop(budget: {
    last: number;
}): Promise<void>;
export declare function scanAndPruneSessions(dshHome: string, options: PruneScanOptions): Promise<PruneScanResult>;
/** 一次 stream 剥离的结果。 */
export interface StreamStripOutcome {
    path: string;
    beforeBytes: number;
    afterBytes: number;
    /** 被剥离的 stream 条数。 */
    stripped: number;
    /** 被保留（最近 N 条）的 stream 条数。 */
    kept: number;
}
/** 剥离选项。 */
export interface StreamStripOptions {
    /** 保留最近 N 条 stream（0 = 全剥）。 */
    keepCount: number;
    /** 剥离前备份原日志（默认 true——破坏性操作必须可回滚）。 */
    backup?: boolean;
    /** 备份目录（默认 `<脑数据目录>/strip-backups/`）。 */
    backupDir?: string;
    /** **官方验证 + 兜底还原**（默认 false——只有重启清理路径需要）。
     *
     *  开启后逐文件走：① 原文官方预检（不可读 → 跳过，不白做）② 产物官方验证
     *  （失败 → 不 rename）③ 落盘后官方复验（失败 → 从备份还原）。
     *  见 {@link verifyWithOfficial} 与 {@link isOfficiallyReadable} 的设计说明。 */
    officialVerify?: boolean;
    /** 官方验证的计数累加器（与 officialVerify 配套；跨文件共享）。 */
    officialReport?: OfficialVerifyReport;
}
/** 官方验证 + 兜底还原的计数（跨文件累加，供清理统计）。 */
export interface OfficialVerifyReport {
    /** 检查过的文件数（开启 officialVerify 且走到验证步的）。 */
    checked: number;
    /** 原文官方不可读（本来打不开）而跳过的文件数——**不是**我们改坏的。
     *
     *  **按路径去重**（2026-09-20 修）：strip 与 prune 两阶段各扫同一棵树，
     *  同一个不可读文件会被两阶段各判一次 ⟹ 不去重就翻倍（实测报告里
     *  38 个真值显示成 67）。用 {@link markUnsupported} 计数。 */
    unsupported: number;
    /** 产物验证失败的文件数（未落盘 / 已还原）。 */
    failed: number;
    /** 因验证失败而从备份还原的文件数。 */
    restored: number;
    /** 验证失败且无备份可还原的文件数（原文件保持原样）。 */
    skippedNoBackup: number;
    /** 已计入 unsupported 的路径（**去重内部状态，不参与序列化**——
     *  `cleanup.ts` 落统计时显式重建纯计数对象）。 */
    unsupportedPaths: Set<string>;
}
/** 新建一个官方验证计数（调用侧持有、跨文件共享）。 */
export declare function newOfficialVerifyReport(): OfficialVerifyReport;
/** 记一个「官方不可读」文件——**按路径去重**（同一文件 strip/prune 各扫一次）。 */
export declare function markUnsupported(report: OfficialVerifyReport, path: string): void;
/**
 * 剥离单个会话日志里的 assistant stream。
 *
 * **剥离语义**：把 `data.stream` 换成 `[]`——**不能删字段**。DSH 读侧
 * `assertAssistantSettlementShape`（packages/core/session/src/index.ts:288）
 * 要求 `Array.isArray(data.stream)`，缺字段直接抛
 * `seed assistant/message at index N has invalid settlement fields`；空数组合法，
 * 且 `expandAssistantStream([])` 返回 `[]` → `assertCurrentAssistantStreams`
 * 里 `timed.length === 0` 直接 `continue`（跳过 message.content 一致性校验）。
 * 2026-09-20 实测：11.5MB 会话剥离后 3.4MB（−70%），经 DSH 官方
 * `verifyJsonlCurrentGeneration` 校验通过。
 *
 * **为什么安全**：stream 是模型逐字打字录像（每个 delta + 到达时间），只服务
 * TTFT 这类诊断指标。模型可见历史取自 `message.content`（另一字段，不动），
 * 图片块也在 `content` 里（不在 stream）——剥离对对话内容、模型上下文、
 * 计费全部无损。
 *
 * **保留策略**：从**后往前**数，最近 `keepCount` 条带 stream 的事件保留，
 * 更早的剥离。0 = 全剥。
 *
 * 安全前置：原文件不动，直到新产物写完并通过 seq 连续性门禁；验证后临时
 * 文件 + fsync + 原子 rename。
 *
 * @returns 成功时返回结果；文件不存在 / 无 stream 可剥 / 验证失败时返回
 *          undefined（原文件保持原样）。
 */
export declare function stripSessionStreams(path: string, options: StreamStripOptions): StreamStripOutcome | undefined;
/** 扫描选项（同 PruneScanOptions 的形状）。 */
export interface StreamStripScanOptions extends StreamStripOptions {
    /** 只处理 mtime 早于 (now - minAgeMs) 的日志——排除活跃会话。 */
    minAgeMs?: number;
    /** 物理字节阈值：小于它不动（默认 0 = 全部处理）。 */
    thresholdBytes?: number;
    /** 会话过滤（同 PruneScanOptions.sessionFilter；缺省 = 全部会话）。 */
    sessionFilter?: (sessionId: string, workspace: string) => boolean;
}
export interface StreamStripScanResult {
    stripped: StreamStripOutcome[];
    skipped: number;
    freedBytes: number;
}
/**
 * 扫描一个 DSH 会话根目录下的全部会话日志，逐个剥离 stream。
 *
 * **文件名形态**（2026-09-26 实测全库）：`session.v4.jsonl.zstd`（0.1.7 现行，App 版）
 * / `session.v3.jsonl.zstd`（0.1.5）/ `session.jsonl.zstd`（0.1.4 及更早）。
 * 三者都要处理——**这是既有 `scanAndPruneSessions` 的缺口**（它只认最旧形态，
 * 漏掉 v3 文件 264MB；v4 于 2026-09-26 同缺口补齐）。
 *
 * **归档会话不区分**：一帆 2026-09-20 定「剥离工作区有的全部会话——已归档的
 * 不会被加载进内存不用管」。归档与否不改变「文件在磁盘上占空间」这一事实，
 * 全扫即可。
 */
export declare function scanAndStripStreams(dshHome: string, options: StreamStripScanOptions): Promise<StreamStripScanResult>;
/**
 * 用 **DSH 官方存储契约验证器**校验产物（与宿主读侧同一处、同一拒绝行为）。
 *
 * 为什么用官方验证器而不是自研校验：`storage-contract` 的设计目标原文是
 * *"Backend-shared storage validation … one place so every backend refuses the
 * same inputs identically"*——它就是 DSH 读侧的门。自研三重验证（step 配对 +
 * seq 连续 + 编码读回）只覆盖我们知道的失效模式；官方验证器覆盖**我们不知道
 * 的**（未知事件类型、新版 harness 写的格式、`request/header` 的 legacy
 * `fallback` reason 等），失败即拒绝，正是我们想要的 fail-closed 行为。
 *
 * **⚠️ 必须先展开物理行 → 逻辑事件**（2026-09-20 实测发现）：`validateStoredEvents`
 * 吃的是**逻辑事件**，而 `decodeSessionLog` 产出的是**物理行**——v3 打包行
 * （`assistant/chunk` 等）在逻辑层根本不存在。直接喂物理行会被判
 * `contains event type "assistant/chunk" … unknown to this harness` 而误拒
 * （实测 12 个真实日志里 7 个这样挂掉——它们本身完全健康）。
 * 展开走与 `verifyPrunedTail` 同一个口：`openLogReader(header).decodeAll(rows)`。
 *
 * 三层各自的作用（互补，不重复）：
 *  ① `validateStoredEvents` — 逐事件校验 + 冻结：未知必需事件类型 / legacy
 *     格式即抛（**会原地改写 events 数组**——`adoptSessionEvent` 归一化，
 *     所以传入前先拷贝）。
 *  ② `assertContiguous` — seq 从 0 起连续（DSH 读侧强制不变式）。
 *  ③ `foldSurface` — surface op / provenance / replace 区间可重放。
 *
 * @param header - 日志首行（`type: 'session'` 的 header 对象）。
 * @param events - **物理行**列表（`decodeSessionLog` 的产物；内部先展开成逻辑事件）。
 * @param sessionId - 会话 id（`assertContiguous` 的错误信息用；空串也可）。
 * @returns 通过 `{ ok: true }`；失败 `{ ok: false, reason }`。
 */
export declare function verifyWithOfficial(header: Record<string, unknown>, events: readonly PruneEvent[], sessionId: string): {
    ok: boolean;
    reason?: string;
};
/** 备份文件名解析结果。 */
export interface BackupEntry {
    /** 文件名（不含目录）。 */
    name: string;
    /** 完整路径。 */
    path: string;
    /** 会话键——用于「每会话保留 N 份」分组；无法反查的旧格式为 `__legacy__`。 */
    sessionKey: string;
    /** mtime（排序用——文件名时间戳不可靠时兜底）。 */
    mtimeMs: number;
    bytes: number;
}
/**
 * 从备份文件名解析会话键。
 *
 * 备份命名（`session-prune.ts` 写入侧）：
 *   `<会话目录名>.<ISO时间戳>.jsonl[.zstd]`
 * 会话目录名形如 `session-<UUID>`（0.1.5）或 `<UUID>`（更早）——两种前缀
 * **归一化为同一个 `<UUID>`**（现有 `bin/session-reset.ts` 的双前缀匹配同式）。
 *
 * 无法反查会话的旧格式（`mbsf-prune-<随机>` 等）→ `__legacy__` 单桶，
 * 按同一 keep-N 规则处理（不跳过——否则旧备份永远清不掉）。
 */
export declare function backupSessionKey(name: string): string;
/**
 * 清理备份目录：**每会话保留最近 N 份**（按文件名排序 + mtime 兜底）。
 *
 * 为什么是「每会话 N 份」而不是「总共 N 份」：按总份数截断可能删光某个会话的
 * 全部备份 ⟹ 那个会话就失去回滚能力了。每会话 N 份保证**每个会话都可回滚**。
 *
 * @param dir - 备份目录（`prune-backups/` 或 `strip-backups/`）。
 * @param keepPerSession - 每会话保留份数；**0 = 不设上限**（保留全部，不删）。
 * @returns 删除份数 / 释放字节 / 剩余现状。
 */
export declare function pruneBackupDir(dir: string, keepPerSession: number): {
    removed: number;
    freedBytes: number;
    total: number;
    totalBytes: number;
};
/** 备份目录现状（份数 + 占用），用于设置页显示。 */
export declare function backupDirStats(dir: string): {
    count: number;
    bytes: number;
};
/** 两个备份目录的默认路径（脑数据目录内）。 */
export declare function pruneBackupDirPath(): string;
/** 剥离备份目录的默认路径。 */
export declare function stripBackupDirPath(): string;
/** 一次还原的结果。 */
export interface RestoreOutcome {
    ok: boolean;
    /** 失败原因（ok=false 时）。 */
    reason?: string;
}
/**
 * 从备份还原原文件（`rename` 原子替换）。
 *
 * 为什么 rename 而不是 copy：备份已含完整原文，rename 既原子又省一次全量写。
 * 备份被移走后即消失——这正是想要的（还原成功后不该留着同一份内容两份）。
 *
 * @param backupPath - 备份文件路径。
 * @param targetPath - 原日志路径。
 */
export declare function restoreFromBackup(backupPath: string, targetPath: string): RestoreOutcome;
/**
 * 文件原文是否**官方可读**（改前预检——决定该文件能否进入清理流程）。
 *
 * **为什么需要**（2026-09-20 全库实测）：159 个日志里 **38 个 / 80.7MB
 * （占全库 39.8% 体积）是 v0 旧格式**，DSH 官方迁移链自己就拒绝：
 * `format-v0-to-v1 refuses … compaction/summary data lacks required member`
 * （37 个）与 `format-v2-to-v3 refuses … turn must be positive`（1 个）。
 * **DSH 读侧用的就是同一个 `recovery: 'strict'`**（`dsh-session-persistence-jsonl`
 * `/lib/index.js:983`）⟹ 这些文件 **DSH 自己现在也打不开**。
 *
 * 官方验证器对它们**恒失败**（与我们改没改无关）。若不预检就直接「验证失败
 * 即还原」，strip 会对这 80.7MB 白做一轮（改 → 验证失败 → 还原 → 回原样），
 * 纯浪费且报告里全是假故障。
 *
 * **语义**：验证的目的是「证明**我们的改动**没弄坏文件」。对本来就打不开的
 * 文件，验证失败不构成「我们弄坏了」的证据 ⟹ 原文验不过 = **跳过该文件**
 * （不修改、不还原），报告标「官方格式不支持」——诚实降级，不假装成功。
 *
 * @returns 可读 `true`；不可读 / 读不了 `false`（含 reason）。
 */
export declare function isOfficiallyReadable(header: Record<string, unknown>, events: readonly PruneEvent[], sessionId?: string): {
    readable: boolean;
    reason?: string;
};
export {};
