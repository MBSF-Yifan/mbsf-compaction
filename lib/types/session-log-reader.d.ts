/**
 * 会话流水读取器 — trace 走（回想第二步）的原文重演底座
 *
 * 设计（附录F F.6.3 ② / F.6.4 回想条目 + 2026-08-21 消息级索引治本）：
 *  - 回想两步：① 入口 = 离散同型判定（C.8 落位 A）
 *    ② 展开 = trace 走——位置寻址 + 重演（⚠️ 7.3.2 措辞修正：refs =
 *    识别边/位置索引，不是路径边，不「沿边反向走回」；位置寻址 =
 *    refs 定位流水原文）→ 重演该段线（重演 = 照流水记录复原同一区分
 *    序列 = 精确；重新区分 = 在当下语境再走一遍 = 新动作 = 有损）。
 *  - 位置必须指向流水原文（不能只指向话题节点）——本模块实现「位置 →
 *    流水原文」的读取侧：kind='session' 的位置（sessionKey + msgIndex）
 *    定位到 DSH 会话存档里的原文。
 *
 * 消息级索引（2026-08-21 治本——OOM 修复）：
 *  - 旧实现整条流水 readFileSync + 全量解压所有帧拼接（119MB 压缩 →
 *    ~1GB 明文）→ split('\n') 33 万行 JSON.parse → _msgCache 整线驻留
 *    = 峰值内存 O(线长)（1GB 明文 + 33 万事件对象）= OOM 根源。
 *  - 实测（真实流水 118.5MB）：zstd 拼接帧 33 万帧，其中对话消息仅
 *    1134 条（其余全是 turn/step/注入事件帧）——全量 1GB 明文里 99.9%
 *    是事件结构，对话原文只有 ~1MB。治本 = 只保留对话消息原文：
 *    ① 消息级索引 = 建索引时逐帧解压（峰值 = 单帧明文，非整线）+ 只
 *       提取对话消息原文 push 进索引（1134 条 ≈ 1-2MB/会话——1000 倍
 *       缩容），持久化 ~/.mbsf/session-message-index/
 *       <uuid>.json（原子写），进程重启免解压；
 *    ② 测地线展开 = 定位时 O(消息数) 前缀匹配（与旧语义 100% 一致：
 *       snippet 内容识别 + msgIndex 仅作偏差排序键——msgIndex 是 DSH
 *       消息列表下标，与流水对话消息序不成线性，**不能作定位键**，
 *       2026-08-21 帧索引位置系错误实测 0/200 命中后修正）——用完即弃，
 *       会话索引 LRU(cap 8)，内存 O(消息数) 不 O(线长)；
 *    ③ append-only 增量——只扫尾部新帧（逐帧解压提取追加），不重建。
 *  - 索引失效（流水截断/轮转/原地改写）→ size/mtime 校验不通过 →
 *    重建或返回 null 诚实降级（位置保留 snippet 一瞥）。
 *
 * 流水形态（DSH session-persistence-jsonl，同仓 MIT）：
 *  - 路径：`~/.dsh/sessions/<workspace>/session-<uuid>/session.jsonl.zstd`
 *    （明文 `session.jsonl` 兜底）。sessionKey = agent.session.id =
 *    `session-<uuid>`，与目录名一致。
 *  - 格式：zstd 拼接帧（Node `node:zlib` zstdDecompressSync 零外部依赖）
 *    的 JSONL——首行 session 头，后续每行一个 SessionEvent：
 *    `user/message` / `assistant/message`（data.content[] text + role）、
 *    `turn/start`、`step/start`、`agent/inbox/spliced` 等。
 *
 * 消息口径（msgIndex 对齐）：
 *  - 位置的 msgIndex = SummarizeInput.messages（DSH 重放的消息列表）下标；
 *    流水是事件流（含 runtime snapshot 等注入的 user/message），不逐行
 *    对应。本模块用「内容识别」定位：收集 user/assistant 消息后，用
 *    位置的 snippet（消息前 60 字符，空白归一化）做前缀/包含匹配——
 *    从位置走回原文 = 识别同一（= 动作），而非机械下标；msgIndex 只做
 *    多候选排序键（偏差最小者优先）。
 *
 * 零依赖：node:zlib zstd（Node ≥22.17）→ 失败降级明文 .jsonl →
 * 再失败返回 null（位置保留 snippet 一瞥，诚实降级）。
 *
 * 状态标注：与 索引层 同标  层（「记忆」正典零出现，工程实现）。
 *
 * @module mbsf-compaction/session-log-reader
 */
/** 流水根（环境变量可覆写；默认 ~/.dsh/sessions）。 */
export declare const SESSIONS_ROOT: string;
/** 提取 sessionKey 中的 uuid（`session-<uuid>` 或裸 `<uuid>`）。 */
export declare function sessionUuid(sessionKey: string): string;
export declare function findSessionLog(sessionKey: string, root?: string): string | null;
/**
 * 扫描 zstd 拼接帧边界（不解压）——从 offset 起逐帧解析帧头/块头，
 * 返回每帧的 [start, end) 字节区间。供索引建表/增量用；解压由调用方
 * 按需逐帧做（峰值 = 单帧明文，不整线拼接）。
 * @throws 帧结构损坏。
 */
export declare function scanZstdFrameBounds(buffer: Buffer, offset?: number): Array<{
    start: number;
    end: number;
}>;
/** 流水中的一条对话消息（user/assistant 事件）。 */
export interface LogMessage {
    /** 事件 seq（流水顺序）。 */
    seq: number;
    role: string;
    text: string;
}
/**
 * 从流水文本提取对话消息列表（user/message + assistant/message 事件；
 * 排除 role='system' 与无文本事件）。seq 升序。
 *
 * ⚠️ 载荷形状二分（2026-09-26 P0 修复——assistant 消息从未入索引）：
 *  - `user/message`：消息本体**内联**在 `data`（`data.role` + `data.content`）；
 *  - `assistant/message`（及 v4 的 system/developer/tool-result 同族）：消息本体
 *    在 **`data.message`**（`data.message.role` + `data.message.content`），
 *    `data` 自身只带 step/turn/usage 等运行态字段。
 *  旧实现两者都读 `data.content` ⟹ assistant 恒空 ⟹ 被 `if (!text) continue`
 *  静默丢弃——实测全库 3002 条消息**零条 assistant**（回想第二步 trace 只能
 *  走回 user 原文，走不回 assistant 原文；温故同缺）。此处按事件类型取对槽位。
 *  v3→v4 迁移不改变这两个槽位的形状（`user/message` 内联 / 其余 `message` 嵌套
 *  ——见 dsh-session-format-v3-to-v4 的 declared message traversal）。
 */
export declare function extractLogMessages(jsonl: string): LogMessage[];
/** 空白归一化（与 索引层 snippet 同口径：连续空白 → 单空格）。 */
export declare function normalizeWs(text: string): string;
/**
 * trace 走的核心：按位置（sessionKey + msgIndex + snippet）从流水原文
 * 重演该段线。
 *
 * 定位 = 消息级索引内容识别（与旧全量语义 100% 一致——snippet 前缀
 * 匹配 + 包含匹配，多候选取与 msgIndex 偏差最小者）：
 *  - msgIndex 是 DSH 消息列表（SummarizeInput.messages）下标，与流水
 *    对话消息序**不成线性**（流水含注入/运行态事件帧）——因此 msgIndex
 *    只作排序键不作定位键（2026-08-21 帧索引以 msgIndex 定位帧实测
 *    0/200 命中——位置系错误，修正为消息级内容识别）；
 *  - 找不到 → null（流水已清理/位置过期/索引失效——诚实降级，调用方
 *    保留 snippet 一瞥）。
 *
 * @returns 重演的完整原文（该条消息全文）与流水顺序，供调用方展示。
 */
export declare function resolveSessionRef(sessionKey: string, msgIndex: number, snippet: string, root?: string): {
    text: string;
    seq: number;
    matched: boolean;
} | null;
/**
 * 解析任意位置（trace 走对两类位置的统一入口）：
 *  - kind='memory-file'：直接读文件（span 裁剪）；
 *  - kind='session'：resolveSessionRef（流水原文，消息级索引定位）。
 * 解析失败返回 null（位置保留 snippet 一瞥）。
 */
export declare function resolveRef(ref: {
    kind: 'session' | 'memory-file';
    sessionKey?: string;
    msgIndex?: number;
    path?: string;
    span?: {
        start: number;
        end: number;
    } | null;
    snippet: string;
}, root?: string): {
    text: string;
    source: string;
} | null;
