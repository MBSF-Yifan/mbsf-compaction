import { createRequire } from "node:module";
import * as fs from "node:fs";
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, totalmem } from "node:os";
import * as path from "node:path";
import { dirname, join, resolve, sep } from "node:path";
import { getHeapStatistics } from "node:v8";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { AUTO_RECLAIM_PCT_MAX, AUTO_RECLAIM_PCT_MIN, COMPACT_TAIL_MESSAGES_MAX, COMPACT_TAIL_MESSAGES_MIN, catalogProbeReport, clearDerivedCaches, foldHistory, getRuntimeConfig, idleSnapshot, isIdle, lastSummarizeStats, latencyStats, mbsfStats, resolveDshHeapMaxMb, setRuntimeConfig, verifierProbeReport } from "mbsf-compaction/compaction";
import { constants, zstdDecompressSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import "@deepseek-ai/dsh-session";
import "@deepseek-ai/dsh-session-persistence";
import * as bundledCatalogPkg from "@deepseek-ai/dsh-session-format-catalog";
/** 把任意输入钳到合法 tail 窗口（8–256，整数）。 */
function clampTailMessages(value) {
	return Math.min(256, Math.max(8, typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 64));
}
/** DSH 堆上限默认值（MB）——16GB 机器的一半（与 dsh-web 启动器的
*  DEFAULT_HEAP_MB 同值——两条启动路径的默认必须一致）。 */
/** [OBS] 物理资源参照（本机 16GB 的一半）——**外部约束值不是内容常数**：必须与
*  dsh-web 启动器的 `DEFAULT_HEAP_MB` 一致（两条启动路径默认不同 = 用户换个入口
*  就崩，2026-11-01 事故即此类）。不进判定层。 */
const DSH_HEAP_DEFAULT_MB = 8192;
/** 堆上限的合法下界（MB）——低于 node 默认（本机实测 4288）无意义。
*  [OBS] 物理资源护栏——V8 老生代下限，低于它设了也等于没设。 */
const DSH_HEAP_MIN_MB = 4096;
/** 系统保留内存（MB）——算上限时从物理内存里扣掉（macOS 系统 + 浏览器
*  + 其他应用）。
*  [OBS] 物理资源参照（6GB 经验值）——16GB 机器 → 上限 16−6 = 10GB，
*  再向下取整到 GB。外部约束值，不进判定层。 */
const DSH_HEAP_RESERVE_MB = 6144;
/** 本机允许的最大堆上限（MB）——物理内存 − 系统保留，向下取整到 GB，
*  下界 4096。
*
*  **为什么用 totalmem 而非 freemem**：macOS 把空闲内存尽量用作文件缓存，
*  freemem 实测只有 88MB（用它算上限会得到 0）。物理总量才是真边界。 */
function resolveDshHeapMaxMb$1() {
	const totalMb = totalmem() / 1048576;
	const maxMb = Math.floor((totalMb - DSH_HEAP_RESERVE_MB) / 1024) * 1024;
	return Math.max(DSH_HEAP_MIN_MB, maxMb);
}
/** 堆上限默认值——不超过本机允许的最大值（小内存机器自动降档）。 */
function defaultDshHeapMb() {
	return Math.min(DSH_HEAP_DEFAULT_MB, resolveDshHeapMaxMb$1());
}
/** 堆上限合法域钳制：0（不注入）或 ≥ 4096（取整到 1024）。
*  同 normalizeCleanupPruneTurns 的「0 或 ≥N」形态（UI 滑块拖进空洞时用）。 */
function normalizeDshHeapMb(value) {
	if (!Number.isFinite(value) || value <= 0) return 0;
	if (value < 4096) return DSH_HEAP_MIN_MB;
	return Math.floor(value / 1024) * 1024;
}
/** 崩溃快照目录（`--diagnostic-dir` 指向它）。**必须在起 dsh 前建好**——
*  V8 不会自建（实测：目录不存在时快照静默丢失）。 */
function heapSnapshotDir() {
	return join(resolveMbsfDataDir(), "heap-snapshots");
}
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
function withDshHeapFlags(execArgv) {
	const next = [...execArgv];
	const config = getRuntimeConfig$1();
	if (config.dshHeapMb <= 0) return next;
	const isDesktop = Boolean(process.versions.electron);
	if (!isDesktop && next.some((a) => a.startsWith("--max-old-space-size"))) return next;
	const filtered = isDesktop ? next.filter((a) => !a.startsWith("--max-old-space-size")) : next;
	filtered.push(`--max-old-space-size=${config.dshHeapMb}`);
	filtered.push("--heapsnapshot-near-heap-limit=1");
	filtered.push(`--diagnostic-dir=${heapSnapshotDir()}`);
	return filtered;
}
/** 确保快照目录存在（起 dsh 前调用——V8 不自建）。 */
function ensureHeapSnapshotDir() {
	try {
		mkdirSync(heapSnapshotDir(), { recursive: true });
	} catch {}
}
const CONFIG_FILE = "config.json";
let _runtimeConfig = null;
/** 脑数据目录（与 mbsfSummarize 同一解析：env 覆盖，默认 ~/.mbsf）。 */
function resolveMbsfDataDir() {
	return process.env.MBSF_DATA ?? join(process.env.HOME || "/tmp", ".mbsf");
}
function defaults() {
	return {
		injectEnabled: process.env.MBSF_INJECT_DISABLED === "0",
		dateAnchorEnabled: process.env.MBSF_DATE_ANCHOR_DISABLED !== "1",
		autoCompact: true,
		restartCleanupEnabled: false,
		cleanupPruneTurns: 0,
		backupKeepCount: 3,
		restartButtonVisible: false,
		activityIndicatorEnabled: true,
		activityLabelEnabled: true,
		sessionStreamKeepCount: 200,
		dshHeapMb: defaultDshHeapMb(),
		autoReclaimEnabled: false,
		autoReclaimThresholdPct: 60,
		compactTailMessages: 64
	};
}
/** 加载（首次）或返回缓存的运行时配置；config.json 覆盖 env 默认。 */
function loadRuntimeConfig() {
	if (_runtimeConfig) return _runtimeConfig;
	const value = defaults();
	const p = join(resolveMbsfDataDir(), CONFIG_FILE);
	try {
		if (existsSync(p)) {
			const raw = JSON.parse(readFileSync(p, "utf8"));
			if (typeof raw.injectEnabled === "boolean") value.injectEnabled = raw.injectEnabled;
			if (typeof raw.dateAnchorEnabled === "boolean") value.dateAnchorEnabled = raw.dateAnchorEnabled;
			if (typeof raw.autoCompact === "boolean") value.autoCompact = raw.autoCompact;
			if (typeof raw.restartCleanupEnabled === "boolean") value.restartCleanupEnabled = raw.restartCleanupEnabled;
			if (typeof raw.cleanupPruneTurns === "number" && Number.isFinite(raw.cleanupPruneTurns) && (raw.cleanupPruneTurns === 0 || raw.cleanupPruneTurns >= 3)) value.cleanupPruneTurns = Math.floor(raw.cleanupPruneTurns);
			if (typeof raw.backupKeepCount === "number" && Number.isFinite(raw.backupKeepCount) && raw.backupKeepCount >= 0) value.backupKeepCount = Math.floor(raw.backupKeepCount);
			if (typeof raw.restartButtonVisible === "boolean") value.restartButtonVisible = raw.restartButtonVisible;
			if (typeof raw.activityIndicatorEnabled === "boolean") value.activityIndicatorEnabled = raw.activityIndicatorEnabled;
			if (typeof raw.activityLabelEnabled === "boolean") value.activityLabelEnabled = raw.activityLabelEnabled;
			if (typeof raw.sessionStreamKeepCount === "number" && Number.isFinite(raw.sessionStreamKeepCount) && raw.sessionStreamKeepCount >= 0) value.sessionStreamKeepCount = Math.floor(raw.sessionStreamKeepCount);
			if (typeof raw.dshHeapMb === "number" && Number.isFinite(raw.dshHeapMb) && (raw.dshHeapMb === 0 || raw.dshHeapMb >= 4096)) value.dshHeapMb = normalizeDshHeapMb(raw.dshHeapMb);
			if (typeof raw.autoReclaimEnabled === "boolean") value.autoReclaimEnabled = raw.autoReclaimEnabled;
			if (typeof raw.autoReclaimThresholdPct === "number" && Number.isFinite(raw.autoReclaimThresholdPct) && raw.autoReclaimThresholdPct >= 20 && raw.autoReclaimThresholdPct <= 95) value.autoReclaimThresholdPct = Math.round(raw.autoReclaimThresholdPct);
			if (typeof raw.compactTailMessages === "number" && Number.isFinite(raw.compactTailMessages)) value.compactTailMessages = clampTailMessages(raw.compactTailMessages);
		}
	} catch {}
	_runtimeConfig = value;
	return _runtimeConfig;
}
/** 当前运行时配置（惰性加载）。 */
function getRuntimeConfig$1() {
	return loadRuntimeConfig();
}
//#endregion
//#region lib/types/session-log-reader.js
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
const SESSIONS_ROOT = process.env.MBSF_SESSIONS_ROOT ?? path.join(process.env.HOME || "/tmp", ".dsh", "sessions");
/** 提取 sessionKey 中的 uuid（`session-<uuid>` 或裸 `<uuid>`）。 */
function sessionUuid(sessionKey) {
	const m = /(?:session-)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(sessionKey);
	return m && m[1] ? m[1].toLowerCase() : "";
}
/**
* 定位会话流水文件。
*
* 路径形态（2026-09-24 round 22 实测修复——原实现只认旧形态，
* 87% 会话 miss ⟹ 每次 miss 递归全扫 166 目录 = readdir 热点根因）：
*  - 目录名：旧 `session-<uuid>` / 新裸 `<uuid>`（0.1.5 现行）；
*  - 文件名：旧 `session.jsonl`(.zstd) / 0.1.5 `session.v3.jsonl`(.zstd) /
*    0.1.7 `session.v4.jsonl`(.zstd)（App 版实测写 v4——2026-09-26 补齐）。
*  候选文件名 × 两种目录名 = 先直查，命中即返回——常见情形零递归）。
*  workspace 层（`<root>/<workspace>/<dir>/`）用一层 readdir 兜底缓存；
*  深层递归仅最后兜底（且**不再重复递归**——命中失败即 null）。
*/
const _wsDirsCache = /* @__PURE__ */ new Map();
/** workspace 目录缓存 TTL。
*   纯缓存参数——60s 内复用 readdir 结果（避免每次解析都扫盘）；
*  过期只是重扫一次，不影响任何结果。 */
const WS_CACHE_TTL_MS = 6e4;
/**
* 流水文件名候选（新→旧）。
* ⚠️ 单一真源：v4 文件名于 2026-09-26 补入（App 版 0.1.7 实测写
* `session.v4.jsonl.zstd`）。任何新增格式版本在此处加一行即可。
*/
const SESSION_FILE_NAMES = [
	"session.v4.jsonl.zstd",
	"session.v3.jsonl.zstd",
	"session.jsonl.zstd",
	"session.v4.jsonl",
	"session.v3.jsonl",
	"session.jsonl"
];
function _workspaceDirs(root) {
	const hit = _wsDirsCache.get(root);
	const now = Date.now();
	if (hit && now - hit.at < WS_CACHE_TTL_MS) return hit.dirs;
	let dirs = [];
	try {
		dirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
	} catch {}
	_wsDirsCache.set(root, {
		at: now,
		dirs
	});
	return dirs;
}
function findSessionLog(sessionKey, root = SESSIONS_ROOT) {
	const uuid = sessionUuid(sessionKey);
	if (!uuid) return null;
	const dirNames = [`session-${uuid}`, uuid];
	for (const d of dirNames) for (const f of SESSION_FILE_NAMES) {
		const c = path.join(root, d, f);
		if (fs.existsSync(c)) return c;
	}
	for (const ws of _workspaceDirs(root)) for (const d of dirNames) for (const f of SESSION_FILE_NAMES) {
		const c = path.join(root, ws, d, f);
		if (fs.existsSync(c)) return c;
	}
	return null;
}
const ZSTD_MAGIC = 4247762216;
/**
* 扫描 zstd 拼接帧边界（不解压）——从 offset 起逐帧解析帧头/块头，
* 返回每帧的 [start, end) 字节区间。供索引建表/增量用；解压由调用方
* 按需逐帧做（峰值 = 单帧明文，不整线拼接）。
* @throws 帧结构损坏。
*/
function scanZstdFrameBounds(buffer, offset = 0) {
	const frames = [];
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) throw new Error("corrupt zstd log: truncated frame magic");
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`corrupt zstd log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) throw new Error("corrupt zstd log: truncated frame header");
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error("corrupt zstd log: reserved frame-header bit");
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) throw new Error("corrupt zstd log: truncated frame header fields");
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) throw new Error("corrupt zstd log: truncated block header");
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error("corrupt zstd log: reserved block type");
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) throw new Error("corrupt zstd log: truncated block payload");
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) throw new Error("corrupt zstd log: truncated checksum");
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
	}
	return frames;
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
function extractLogMessages(jsonl) {
	const out = [];
	for (const line of jsonl.split("\n")) {
		if (!line.trim()) continue;
		let ev;
		try {
			ev = JSON.parse(line);
		} catch {
			continue;
		}
		if (ev.type !== "user/message" && ev.type !== "assistant/message") continue;
		const carrier = ev.type === "user/message" ? ev.data : ev.data?.message ?? ev.data;
		const role = carrier?.role ?? "";
		if (role === "system") continue;
		const text = extractContentText(carrier?.content);
		if (!text) continue;
		out.push({
			seq: ev.seq ?? 0,
			role,
			text
		});
	}
	out.sort((a, b) => a.seq - b.seq);
	return out;
}
/** 从 content blocks 提取文本（与 mbsf extractText 同口径：text block 拼接）。 */
function extractContentText(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.filter((c) => c?.type === "text").map((c) => String(c.text ?? "")).join("\n");
	return "";
}
/** 空白归一化（与 索引层 snippet 同口径：连续空白 → 单空格）。 */
function normalizeWs(text) {
	return text.replace(/\s+/g, " ").trim();
}
//#endregion
//#region ../02-packages/core/lib/vendor/encoder.js
/**
* Self-Encoding v7 — TL 塔旋转编码
*
* 视角: 文本 = 区分操作序列
*   字节 → 投影子选择 → ω += γ · Pω → normalize
*   γ ∝ 投影残差 (新信息多→大步, 已知→小步)
*
* 不同文本 = 不同字节序列 = 不同旋转方向 = 不同终端态
* 不同上下文 = 不同起始 ω = 同一文本走不同路径
*
* D = 233 (H_12 Bratteli 路径数)
* 投影子: NP = H_12 的 e_k + 级联嵌入桥
*
* 导出: { D, encode, cosineSimilarity, symmetricInitial, NP }
*   encode(text, omega0?) → { omega: number[], trace: {projIdx, gamma}[] }
*/
const φ = (1 + Math.sqrt(5)) / 2;
const φ_inv = φ - 1;
const μ = [
	1,
	φ,
	φ,
	1
];
function neighbors(v) {
	const n = [];
	if (v > 0) n.push(v - 1);
	if (v < 3) n.push(v + 1);
	return n;
}
function paths(n, s) {
	const p = [];
	(function w(v, h) {
		if (h.length === n + 1) {
			if (v === s) p.push(h.slice());
			return;
		}
		const ns = neighbors(v);
		for (let i = 0; i < ns.length; i++) {
			h.push(ns[i]);
			w(ns[i], h);
			h.pop();
		}
	})(0, [0]);
	return p;
}
function buildEk(ps, k) {
	const d = ps.length, m = [];
	for (let i = 0; i < d; i++) {
		m[i] = [];
		for (let j = 0; j < d; j++) m[i][j] = 0;
	}
	for (let i = 0; i < d; i++) {
		const p = ps[i];
		if (p[k - 1] === p[k + 1]) m[i][i] = μ[p[k]] / μ[p[k - 1]];
	}
	for (let i = 0; i < d; i++) for (let j = i + 1; j < d; j++) {
		let same = true;
		for (let pos = 0; pos < ps[i].length; pos++) if (pos !== k && ps[i][pos] !== ps[j][pos]) {
			same = false;
			break;
		}
		if (same) {
			const v = Math.sqrt(μ[ps[i][k]] * μ[ps[j][k]]) / μ[ps[i][k - 1]];
			m[i][j] = v;
			m[j][i] = v;
		}
	}
	return m;
}
function cellMod(n, s) {
	const ps = paths(n, s);
	if (ps.length === 0) return null;
	const pks = [];
	for (let k = 1; k < n; k++) {
		const ek = buildEk(ps, k);
		pks.push(ek.map((r) => r.map((c) => c / φ)));
	}
	return {
		level: n,
		sector: s,
		dim: ps.length,
		paths: ps,
		projs: pks
	};
}
function hN(n) {
	const mods = [];
	for (let s = 0; s <= 3; s++) {
		const cm = cellMod(n, s);
		if (cm) mods.push(cm);
	}
	let dim = 0;
	mods.forEach((m) => dim += m.dim);
	return {
		level: n,
		dim,
		modules: mods
	};
}
function inclusion(Hn, Hnp1) {
	const Dn = Hn.dim, Dnp1 = Hnp1.dim;
	const I = [];
	for (let i = 0; i < Dnp1; i++) {
		I[i] = [];
		for (let j = 0; j < Dn; j++) I[i][j] = 0;
	}
	let offSrc = 0;
	for (let mi = 0; mi < Hn.modules.length; mi++) {
		const src = Hn.modules[mi];
		for (let pi = 0; pi < src.paths.length; pi++) {
			const p = src.paths[pi], v = p[p.length - 1], nb = neighbors(v);
			for (let ni = 0; ni < nb.length; ni++) {
				const w = nb[ni], ep = p.concat([w]);
				let offDst = 0;
				for (let mj = 0; mj < Hnp1.modules.length; mj++) {
					const dst = Hnp1.modules[mj];
					for (let qi = 0; qi < dst.paths.length; qi++) if (dst.paths[qi].length === ep.length) {
						let match = true;
						for (let pos = 0; pos < ep.length; pos++) if (ep[pos] !== dst.paths[qi][pos]) {
							match = false;
							break;
						}
						if (match) I[offDst + qi][offSrc + pi] = Math.sqrt(μ[w] / μ[v]);
					}
					offDst += dst.dim;
				}
			}
		}
		offSrc += src.dim;
	}
	return I;
}
function matMul(A, B) {
	const n = A.length, m = B[0].length, l = B.length, C = [];
	for (let i = 0; i < n; i++) {
		C[i] = [];
		for (let j = 0; j < m; j++) {
			let s = 0;
			for (let k = 0; k < l; k++) s += A[i][k] * B[k][j];
			C[i][j] = s;
		}
	}
	return C;
}
function transp(M) {
	return M[0].map((_, i) => M.map((r) => r[i]));
}
function dot(a, b) {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}
function normV(v) {
	return Math.sqrt(dot(v, v));
}
function scaleV(v, s) {
	return v.map((x) => x * s);
}
function addV(a, b) {
	const r = [];
	for (let i = 0; i < a.length; i++) r[i] = a[i] + b[i];
	return r;
}
function subV(a, b) {
	const r = [];
	for (let i = 0; i < a.length; i++) r[i] = a[i] - b[i];
	return r;
}
const MAX_LEVEL = 12;
const Hs = {};
const Is = {};
for (let n = 4; n <= MAX_LEVEL; n++) Hs[n] = hN(n);
for (let n = 4; n < MAX_LEVEL; n++) Is[n] = inclusion(Hs[n], Hs[n + 1]);
const Htop = Hs[MAX_LEVEL];
const D = Htop.dim;
const allP = [];
let off = 0;
for (let mi = 0; mi < Htop.modules.length; mi++) {
	const mod = Htop.modules[mi];
	for (let k = 0; k < mod.projs.length; k++) {
		const emb = [];
		for (let i = 0; i < D; i++) {
			emb[i] = [];
			for (let j = 0; j < D; j++) emb[i][j] = 0;
		}
		for (let i = 0; i < mod.projs[k].length; i++) for (let j = 0; j < mod.projs[k][0].length; j++) emb[off + i][off + j] = mod.projs[k][i][j];
		const P = matMul(emb, emb);
		for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) if (Math.abs(P[r][c]) < 1e-14) P[r][c] = 0;
		allP.push(P);
	}
	off += mod.dim;
}
for (let n = 4; n < MAX_LEVEL; n++) if (Is[n]) {
	let result = matMul(Is[n], transp(Is[n]));
	for (let i = 0; i < result.length; i++) for (let j = 0; j < result[0].length; j++) result[i][j] /= φ;
	for (let l = n + 1; l < MAX_LEVEL; l++) {
		result = matMul(matMul(Is[l], result), transp(Is[l]));
		for (let i = 0; i < result.length; i++) for (let j = 0; j < result[0].length; j++) result[i][j] /= φ;
	}
	const P = matMul(result, result);
	for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) if (Math.abs(P[r][c]) < 1e-14) P[r][c] = 0;
	allP.push(P);
}
const NP = allP.length;
/**
* 将 D×D 稠密投影矩阵转为稀疏行表示
* 每行: [{ j: number, v: number }, ...]
*
* 98% 稀疏度 → 50x 矩阵-向量乘加速
*/
function sparsePrj(denseMat) {
	const rows = new Array(D);
	for (let i = 0; i < D; i++) {
		const row = [];
		for (let j = 0; j < D; j++) if (Math.abs(denseMat[i][j]) > 1e-14) row.push({
			j,
			v: denseMat[i][j]
		});
		rows[i] = row;
	}
	return rows;
}
function sparseApply(rows, v) {
	const res = new Array(D);
	for (let i = 0; i < D; i++) {
		let s = 0;
		const row = rows[i];
		for (let k = 0; k < row.length; k++) s += row[k].v * v[row[k].j];
		res[i] = s;
	}
	return res;
}
const allPsp = allP.map(sparsePrj);
function utf8Bytes(text) {
	const s = String(text);
	const bytes = [];
	for (let ci = 0; ci < s.length; ci++) {
		const cp = s.charCodeAt(ci);
		if (cp < 128) bytes.push(cp);
		else if (cp < 2048) {
			bytes.push(192 | cp >> 6);
			bytes.push(128 | cp & 63);
		} else if (cp < 65536) {
			bytes.push(224 | cp >> 12);
			bytes.push(128 | cp >> 6 & 63);
			bytes.push(128 | cp & 63);
		} else {
			bytes.push(240 | cp >> 18);
			bytes.push(128 | cp >> 12 & 63);
			bytes.push(128 | cp >> 6 & 63);
			bytes.push(128 | cp & 63);
		}
	}
	return bytes;
}
/**
* 一步旋转: ω → ω + γ · Pω → normalize
* γ ∝ |ω - Pω| / |Pω| (投影残差比例), cap = φ⁻¹
*
* γ 接近 0: P 投影与当前 ω 一致 → 已知模式
* γ 接近 φ⁻¹: P 投影带全新方向 → 新区分
*/
function rotateToward(omega, projIdx) {
	const PjOmega = projIdx >= 0 && projIdx < allPsp.length ? sparseApply(allPsp[projIdx], omega) : new Array(D).fill(0);
	const pNorm = normV(PjOmega);
	if (pNorm < 1e-14) return {
		omega: omega.slice(),
		gamma: 0
	};
	const resNorm = normV(subV(omega, PjOmega));
	const gamma = Math.min(resNorm / pNorm, φ_inv);
	let omegaNew = addV(omega, scaleV(PjOmega, gamma));
	const n = normV(omegaNew);
	if (n > 1e-14) omegaNew = scaleV(omegaNew, 1 / n);
	return {
		omega: omegaNew,
		gamma
	};
}
function symmetricInitial() {
	const om = new Array(D);
	const v = Math.sqrt(1 / D);
	for (let i = 0; i < D; i++) om[i] = v;
	return om;
}
/**
* 编码文本为视角轨迹
*
* @param {string} text
* @param {number[]} [omega0] 起始态, 默认对称初态
* @returns {{ omega: number[], trace: {projIdx: number, gamma: number}[] }}
*/
function encode(text, omega0) {
	const bytes = utf8Bytes(text);
	let omega = (omega0 || symmetricInitial()).slice();
	const trace = [];
	for (let i = 0; i < bytes.length; i++) {
		const pIdx = bytes[i] % NP;
		const result = rotateToward(omega, pIdx);
		trace.push({
			projIdx: pIdx,
			gamma: result.gamma
		});
		omega = result.omega;
	}
	return {
		omega,
		trace
	};
}
new Set("。，、：；！？「」『』（）《》〈〉【】—…·,.!?;:\"'()[]{}~`-+=*/\\|<>@#$%^&_ 	\n\r".split(""));
/**
* 余弦相似度: |dot(a,b)| / (|a|·|b|)
* 视角匹配的核心度量
*/
function cosineSimilarity(a, b) {
	let d = 0, na = 0, nb = 0;
	for (let i = 0; i < D; i++) {
		d += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	const n = Math.sqrt(na) * Math.sqrt(nb);
	if (n < 1e-14) return na < 1e-14 && nb < 1e-14 ? 1 : 0;
	return Math.abs(d / n);
}
/**
* v23: 迹内积相似度
*
* 不比较 ω 向量, 而是比较编码过程中激活的投影子分布。
* 两个 trace 共享的投影子越多, 代数结构越相似。
*
* 直觉: ω 向量坍缩到同一吸引盆后 cosine→0.97, 区分力丧失。
* 迹内积直接比较"走了哪些代数步骤", 不受吸引盆影响。
*
* trace: [{projIdx, gamma}, ...]
* gamma: 该步投影残差 (新信息量, 已编码在结果中)
*/
function traceHistogram(trace) {
	const hist = new Float64Array(NP);
	for (const step of trace) {
		const g = Number(step.gamma);
		if (g > 0) hist[step.projIdx] += g;
	}
	return hist;
}
function traceSimilarity(traceA, traceB) {
	if (!traceA?.length || !traceB?.length) return 0;
	const hA = traceA.constructor === Float64Array ? traceA : traceHistogram(traceA);
	const hB = traceB.constructor === Float64Array ? traceB : traceHistogram(traceB);
	let sumA = 0, sumB = 0;
	for (let i = 0; i < NP; i++) {
		sumA += hA[i];
		sumB += hB[i];
	}
	if (sumA < 1e-12 || sumB < 1e-12) return 0;
	let dot = 0, nA = 0, nB = 0;
	for (let i = 0; i < NP; i++) {
		const a = hA[i] / sumA, b = hB[i] / sumB;
		dot += a * b;
		nA += a * a;
		nB += b * b;
	}
	const norm = Math.sqrt(nA) * Math.sqrt(nB);
	return norm > 1e-12 ? dot / norm : 0;
}
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename && process.env.MBSF_SELFTEST === "1") {
	console.log("=== v7: TL 塔旋转编码 ===");
	console.log(`D=${D}, NP=${NP}`);
	console.log("");
	const t0 = Date.now();
	for (let i = 0; i < 1e3; i++) encode("测试消息" + i);
	console.log(`1000次: ${Date.now() - t0}ms`);
	const t1 = Date.now();
	encode("A".repeat(5e4));
	console.log(`50KB: ${Date.now() - t1}ms`);
	console.log("");
	for (const { a, b, label } of [
		{
			a: "猫",
			b: "狗",
			label: "猫↔狗"
		},
		{
			a: "猫",
			b: "cat",
			label: "猫↔cat (跨语言)"
		},
		{
			a: "猫很可爱",
			b: "猫非常可爱",
			label: "猫很可爱↔非常可爱"
		},
		{
			a: "我喜欢狗",
			b: "我讨厌狗",
			label: "喜欢↔讨厌"
		},
		{
			a: "ABC",
			b: "CBA",
			label: "ABC↔CBA (字节序)"
		},
		{
			a: "太阳",
			b: "天气",
			label: "太阳↔天气"
		}
	]) {
		const ra = encode(a), rb = encode(b);
		console.log(`  ${label.padEnd(24)} cos=${cosineSimilarity(ra.omega, rb.omega).toFixed(4)}  hist=${traceSimilarity(ra.trace, rb.trace).toFixed(4)}`);
	}
	console.log("");
	const catTexts = [
		"猫",
		"猫很可爱",
		"我的猫",
		"猫咪",
		"小猫",
		"猫粮",
		"撸猫"
	];
	const dogTexts = [
		"狗",
		"狗很忠诚",
		"我的狗",
		"小狗",
		"狗狗",
		"遛狗",
		"宠物狗"
	];
	const weatherTexts = [
		"太阳",
		"下雨",
		"刮风",
		"多云",
		"晴天",
		"天气",
		"阴天"
	];
	function avgCos(texts) {
		const states = texts.map((t) => encode(t).omega);
		let sum = 0, n = 0;
		for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
			sum += cosineSimilarity(states[i], states[j]);
			n++;
		}
		return sum / n;
	}
	function crossCos(aT, bT) {
		const a = aT.map((t) => encode(t).omega);
		const b = bT.map((t) => encode(t).omega);
		let sum = 0, n = 0;
		for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
			sum += cosineSimilarity(a[i], b[j]);
			n++;
		}
		return sum / n;
	}
	console.log("── 组内/组间分离 ──");
	const catIn = avgCos(catTexts);
	const dogIn = avgCos(dogTexts);
	const weatherIn = avgCos(weatherTexts);
	const catDog = crossCos(catTexts, dogTexts);
	const catWeather = crossCos(catTexts, weatherTexts);
	console.log(`  猫 组内: ${catIn.toFixed(4)}`);
	console.log(`  狗 组内: ${dogIn.toFixed(4)}`);
	console.log(`  天气 组内: ${weatherIn.toFixed(4)}`);
	console.log(`  猫↔狗:   ${catDog.toFixed(4)}`);
	console.log(`  猫↔天气: ${catWeather.toFixed(4)}`);
	console.log(`  猫内/猫狗比: ${(catIn / Math.max(catDog, 1e-4)).toFixed(2)}x`);
	console.log("");
	console.log("── 上下文依赖 ──");
	const base = encode("猫喜欢吃鱼");
	const fromCat = encode("猫喜欢吃鱼", encode("猫").omega);
	const fromDog = encode("猫喜欢吃鱼", encode("狗").omega);
	console.log(`  "猫喜欢吃鱼" 从零:        symCos=${cosineSimilarity(base.omega, symmetricInitial()).toFixed(4)}`);
	console.log(`  "猫喜欢吃鱼" 从"猫":      cos(base)=${cosineSimilarity(fromCat.omega, base.omega).toFixed(4)}`);
	console.log(`  "猫喜欢吃鱼" 从"狗":      cos(base)=${cosineSimilarity(fromDog.omega, base.omega).toFixed(4)}`);
	console.log(`  从猫↔从狗:                cos=${cosineSimilarity(fromCat.omega, fromDog.omega).toFixed(4)}`);
	console.log("");
	console.log("=== DONE ===");
}
new Set("。，、：；！？「」『』（）《》〈〉【】—…·“”‘’,.!?;:\"'()[]{}~`-+=*/\\|<>@#$%^& 	\n\r".split(""));
//#endregion
//#region ../02-packages/core/lib/mbsf-core.js
/**
* 未必记忆核心引擎 — Harness 移植版
*
* 从 OpenClaw electronic-sheep-compaction/index.js v24 (v8.6.0-dev) 提取，
* 去掉 openclaw SDK 依赖，TS 化。核心逻辑原样保留：
*
*  - 编码 (encoder.js, D=233, NP=30)
*  - γ = 1 - cos(ω_msg, ω_session) 冗余判定（位置层热度 / EMA——
*    检索载体，见下「判定链改造」注记）
*  - session_ω 旋转 walk 更新 + Δω radical 衰减追踪
*  - gamma EMA 梯度自适应 tail
*  - gray-zone 诚实追踪
*  - deltaCompact 摘要生成
*
* ── 判定链改造（2026-08-25，§2.7 干净方案：两层离散识别判定链）────────────
* 压缩保留判定（deltaCompact 内）从 γ/cos 阈值（工程标定）改为两层离散
* 识别（token 级子串包含，零阈值零比例零编码依赖）：
*  第一层：消息整条是特征（前序摘要 + 本区间已处理消息）某段的连续子串
*    → 完全识别 → 压缩（识别，计数 + 预览，不占原文预算）
*  第二层：贪心最长共享片段切分，逐片段二值——已识别片段压缩，未识别
*    token 按原文区间保留（增量 = 新方向）；无共享 → 全保留。
*  承接点 = 特征末端（B-815 ①）；等同冗余步不进判定链（讨论稿 2.4）。
* 判定不再依赖 γ/cos/阈值——判定 = 纯 token 级离散比较（0.10.4 清账）。
* 残留标定（不参与压缩保留判定，标注不阻塞）：
*  - γ 驱动 tail（adaptiveTailTurns/tailStartIndex）已撤出主路径——tail 起点
*    = 结构判定（structuralTailStart：最后闭合边界之后）；MAX_TAIL_MESSAGES
*    = 无闭合边界时的近因窗口兜底（输出层，保证压缩发生，非判定）
*  - γ/EMA = 位置层热度（indexMessage）与诊断日志（log EMA=），不参与
*    压缩判定
*  - 预算常数（maxChars 分配比例/单条上限）= 输出层工程上限
*  - gammaProfile 的 gray-zone 统计 = 位置层历史字段——判定链不再读取
*    （updateGammaStats 仍记录统计，供 mbsfStats/skill 自检查看）
*
* 脑记忆目录 ~/.mbsf/（从 OpenClaw 复用）：
*  - 读：sessions.json（session ω 种子）、gamma-stats.json（EMA 习惯）、gray-zone.json
*  - 写：gamma-stats.json、gray-zone.json（防抖 writeFileSync——2026-08-31
*    审计校正：非原子写（_saveGammaStats 969/971 无 tmp+rename）；对照
*    索引层 的 renameSync 原子写惯例为项目其他模块所用）
*  - sessions.json / brain-state.json 只读不写（OpenClaw 的 mbsf-d 进程可能仍在使用）
*
* @module @deepseek-ai/dsh-compaction-mbsf/mbsf-core
*/
/** 派生文件目录。发布版无派生根——原样返回；集成侧可自行决定目录布局。 */
function _derivedDirFor(dataDir) {
	return dataDir;
}
const QUIET = process.env.MBSF_DEBUG !== "1";
process.env.MBSF_RESONANCE;
/** 压缩耗时统计（E.25 待办 #3，2026-08-19）：mbsfSummarize 每次压缩
*  记录 elapsedMs → latency-stats.json（独立小文件，不碰 brain-state——
*  OpenClaw mbsf-d 只写）。EMA 平滑 + 最近 LATENCY_RING 条明细。
* （数值工程标定——结构依据见上，无独立 判定依据 依据，可再校准。） */
const LATENCY_FILE = "latency-stats.json";
const COMPACTION_LOG_FILE = "compaction-log.jsonl";
let _latencyN = 0;
let _lastSummarize = null;
/** 读压缩历史（compaction-log.jsonl 尾部 N 条 type='fold' 记录）。
*
*  2026-09-27 A+C 方案：压缩长期只在 session 消息流里对模型可见、对用户
*  隐形（BasicCompactionEngine 把 summarize() 产物包成 createUserMessage
*  写进上下文，不经任何 UI）。本函数把主机侧已有的压缩日志暴露给状态页，
*  让「压了什么」可查。
*
*  实现纪律：只读尾部 Chunk（文件 append-only 且随会话无限增长，全量读会
*  随使用年限变慢）；坏行跳过不阻塞；旧 maintenance/ghost/rad 条目按
*  type 过滤排除（保留只读，不混入压缩历史）。 */
function foldHistory$1(dataDir, limit = 30) {
	try {
		const dir = _derivedDirFor(dataDir);
		const p = path.join(dir, COMPACTION_LOG_FILE);
		if (!fs.existsSync(p)) return [];
		const stat = fs.statSync(p);
		const window = Math.max(64 * 1024, Math.min(1024 * 1024, limit * 200 * 16));
		const start = Math.max(0, stat.size - window);
		const fd = fs.openSync(p, "r");
		let raw;
		try {
			const buf = Buffer.alloc(stat.size - start);
			fs.readSync(fd, buf, 0, buf.length, start);
			raw = buf.toString("utf8");
		} finally {
			fs.closeSync(fd);
		}
		const lines = raw.split("\n");
		if (start > 0) lines.shift();
		const out = [];
		for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
			const line = lines[i].trim();
			if (line.length === 0) continue;
			let obj;
			try {
				obj = JSON.parse(line);
			} catch {
				continue;
			}
			if (obj.type !== "fold" || typeof obj.ts !== "number") continue;
			out.push(obj);
		}
		return out;
	} catch (e) {
		if (process.env.MBSF_DEBUG) console.error("[MBSF] 压缩历史读取失败:", e.message);
		return [];
	}
}
/** 启动恢复压缩统计（2026-08-25 B 方案）：从 latency-stats.json 恢复
*  _latencyN/_latencyEma/_latencyRing/_lastSummarize——压缩次数/EMA/最近
*  压缩不再是「本次运行期间」语义，重启不丢。v1 文件无 lastSummarize
*  → 该字段保持 null（尚未压缩过）；坏数据防御性跳过，不阻塞启动。 */
function _loadLatency(dataDir) {
	try {
		const p = path.join(dataDir, LATENCY_FILE);
		if (!fs.existsSync(p)) return;
		const raw = JSON.parse(fs.readFileSync(p, "utf8"));
		if (typeof raw.n === "number" && raw.n > 0) {
			_latencyN = raw.n;
			typeof raw.emaMs === "number" && raw.emaMs;
			if (Array.isArray(raw.recent) && raw.recent.length > 0) raw.recent.slice(-20);
		}
		const ls = raw.lastSummarize;
		if (ls && typeof ls.at === "number" && typeof ls.textChars === "number") _lastSummarize = ls;
		if (_latencyN > 0 || _lastSummarize !== null) log(`⏱️ 恢复压缩统计: ${_latencyN} 次${_lastSummarize ? `, 最近 ${new Date(_lastSummarize.at).toISOString()}` : ""}`);
	} catch (e) {
		console.error("[MBSF] 压缩统计恢复失败（不阻塞启动）:", e.message);
	}
}
/** 增量原文：无共享消息（keptCount === total）的未识别片段结构上限。
* keptCount === total ⟺ recognized 全 false ⟺ 相邻未识别 span 合并后
* 恒为 1 个片段（整条消息 = 一个片段）——结构恒等，非标定值：无共享 =
* 全新方向 = 整条保留，只受 keptBudget 硬约束。字符上限（旧 SELECTED_
* FULL_CHARS=1500）是外部连续量 ，撤出判定路径（经验规则 编码不是
* 类型 + 结构 5 连续量撤出判定）。 */
function log(...args) {
	if (!QUIET) console.log("[MBSF]", ...args);
}
Object.freeze({
	kind: "mbsf-inject",
	plugin: "mbsf-inject",
	form: "notice",
	summary: "未必记忆记忆一瞥"
});
Object.freeze({
	kind: "mbsf-anchor",
	plugin: "mbsf-anchor",
	form: "notice",
	summary: "未必记忆日期锚"
});
_loadLatency(process.env.MBSF_DATA ?? path.join(process.env.HOME || "/tmp", ".mbsf"));
//#endregion
//#region lib/types/session-override.js
/**
* 会话级配置覆盖（sessions.json）+ 继承链解析
*
* 分层（2026-09-02 一帆固化——子代理/分叉会话默认继承父会话设置）：
*  - 全局 config.json（runtime-config.ts）：新建会话的默认值。
*  - 会话覆盖 `~/.mbsf/sessions.json`：`<sessionId>` →
*    `{ injectEnabled?, dateAnchorEnabled? }`。当前会话无显式覆盖时沿
*    `parentSession` 链向上找第一个覆盖；全链无 → 回落全局（返回 null）。
*  - 生效顺序：会话显式覆盖 > 父会话链 > 全局 config.json > env 默认。
*  - 引擎每次压缩/注入从内存单例读取（mtime 校验实时生效，无需重启）。
*
* parentSession 链读取：当前 agent 的 header 由调用方直接传入（免读盘）；
* 祖先会话经 session-log-reader 读流水首帧首行（zstd 拼接帧第一帧解压）。
*
* @module mbsf-compaction/session-override
*/
const SESSIONS_FILE = "sessions.json";
let _sessionOverrides = null;
let _sessionOverridesMtime = 0;
/** 加载（mtime 校验缓存）全部会话覆盖。 */
function loadSessionOverrides() {
	const p = join(resolveMbsfDataDir(), SESSIONS_FILE);
	try {
		if (existsSync(p)) {
			const mtime = statSync(p).mtimeMs;
			if (_sessionOverrides !== null && _sessionOverridesMtime === mtime) return _sessionOverrides;
			const raw = JSON.parse(readFileSync(p, "utf8"));
			const out = {};
			for (const [sid, v] of Object.entries(raw)) {
				if (typeof v !== "object" || v === null) continue;
				const rec = v;
				const ov = {};
				if (typeof rec.injectEnabled === "boolean") ov.injectEnabled = rec.injectEnabled;
				if (typeof rec.dateAnchorEnabled === "boolean") ov.dateAnchorEnabled = rec.dateAnchorEnabled;
				if (typeof rec.autoCompact === "boolean") ov.autoCompact = rec.autoCompact;
				if (typeof rec.sessionTailMessages === "number" && Number.isFinite(rec.sessionTailMessages)) ov.sessionTailMessages = clampTailMessages(rec.sessionTailMessages);
				if (Object.keys(ov).length > 0) out[sid] = ov;
			}
			_sessionOverrides = out;
			_sessionOverridesMtime = mtime;
			return out;
		}
	} catch {}
	_sessionOverrides = {};
	_sessionOverridesMtime = 0;
	return _sessionOverrides;
}
/** 当前会话自身的显式覆盖（不含父链）。 */
function getSessionOverride(sessionId) {
	return loadSessionOverrides()[sessionId] ?? null;
}
/**
* 写入（合并）会话覆盖并落盘。
* @returns 写入后的完整覆盖（副本）。
*/
function setSessionOverride(sessionId, partial) {
	const all = loadSessionOverrides();
	const cur = { ...all[sessionId] ?? {} };
	if (partial.injectEnabled !== void 0) cur.injectEnabled = partial.injectEnabled;
	if (partial.dateAnchorEnabled !== void 0) cur.dateAnchorEnabled = partial.dateAnchorEnabled;
	if (partial.autoCompact !== void 0) cur.autoCompact = partial.autoCompact;
	if (partial.sessionTailMessages !== void 0 && Number.isFinite(partial.sessionTailMessages)) cur.sessionTailMessages = clampTailMessages(partial.sessionTailMessages);
	if (Object.keys(cur).length > 0) all[sessionId] = cur;
	else delete all[sessionId];
	persistSessionOverrides(all);
	return { ...cur };
}
/** 清除会话覆盖（恢复继承/全局）。 */
function clearSessionOverride(sessionId) {
	const all = loadSessionOverrides();
	if (sessionId in all) {
		delete all[sessionId];
		persistSessionOverrides(all);
	}
}
function persistSessionOverrides(all) {
	const p = join(resolveMbsfDataDir(), SESSIONS_FILE);
	try {
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, JSON.stringify(all, null, 2));
		_sessionOverrides = all;
		_sessionOverridesMtime = statSync(p).mtimeMs;
	} catch {}
}
/**
* 读指定会话流水首帧首行的 header.parentSession（明文/zstd 都支持）。
* 找不到/损坏 → null（链在此截断，回落全局）。
*/
function readParentSession(sessionKey) {
	const logPath = findSessionLog(sessionKey);
	if (logPath === null) return null;
	try {
		const buf = readFileSync(logPath);
		let head;
		if (logPath.endsWith(".zstd")) {
			const frames = scanZstdFrameBounds(buf);
			if (frames.length === 0) return null;
			const first = frames[0];
			head = zstdDecompressSync(buf.subarray(first.start, first.end)).toString("utf8");
		} else head = buf.toString("utf8");
		const firstLine = head.split("\n", 1)[0]?.trim();
		if (!firstLine) return null;
		const parsed = JSON.parse(firstLine);
		return typeof parsed.parentSession === "string" && parsed.parentSession !== "" ? parsed.parentSession : null;
	} catch {
		return null;
	}
}
/**
* 解析会话生效覆盖：自身 → parentSession 链 → null（回落全局）。
* 字段级继承（2026-09-02 固化）：链上所有覆盖并集合并，近者优先——
* 子会话只覆盖 dateAnchor 时，injectEnabled 仍继承父会话的值。
* @param identity - 会话身份；parentSessionId 传入时免读盘（当前 agent 场景）。
*/
function resolveSessionOverrideFor(identity) {
	const seen = /* @__PURE__ */ new Set();
	let current = identity.sessionId;
	let knownParent = identity.parentSessionId;
	const chain = [];
	while (current !== void 0 && !seen.has(current)) {
		seen.add(current);
		const ov = getSessionOverride(current);
		if (ov !== null) chain.push(ov);
		const parent = knownParent ?? readParentSession(current);
		knownParent = void 0;
		current = parent ?? void 0;
	}
	if (chain.length === 0) return null;
	const merged = {};
	for (let i = chain.length - 1; i >= 0; i--) {
		const ov = chain[i];
		if (ov.injectEnabled !== void 0) merged.injectEnabled = ov.injectEnabled;
		if (ov.dateAnchorEnabled !== void 0) merged.dateAnchorEnabled = ov.dateAnchorEnabled;
		if (ov.autoCompact !== void 0) merged.autoCompact = ov.autoCompact;
		if (ov.sessionTailMessages !== void 0) merged.sessionTailMessages = ov.sessionTailMessages;
	}
	return merged;
}
/** 会话配置状态（端点用：生效值 + 覆盖 + 来源）。 */
function sessionConfigStateFor(identity) {
	const global = getRuntimeConfig$1();
	const selfOverride = getSessionOverride(identity.sessionId);
	const resolved = resolveSessionOverrideFor(identity);
	const brief = sessionCompressionBrief(identity.sessionId);
	if (resolved === null) return {
		effective: {
			injectEnabled: global.injectEnabled,
			dateAnchorEnabled: global.dateAnchorEnabled,
			autoCompact: global.autoCompact,
			compactTailMessages: global.compactTailMessages,
			activityIndicatorEnabled: global.activityIndicatorEnabled,
			activityLabelEnabled: global.activityLabelEnabled
		},
		override: selfOverride,
		inheritedFrom: selfOverride !== null ? "session" : "global",
		compressionBrief: brief
	};
	return {
		effective: {
			injectEnabled: resolved.injectEnabled ?? global.injectEnabled,
			dateAnchorEnabled: resolved.dateAnchorEnabled ?? global.dateAnchorEnabled,
			autoCompact: resolved.autoCompact ?? global.autoCompact,
			compactTailMessages: resolved.sessionTailMessages ?? global.compactTailMessages,
			activityIndicatorEnabled: global.activityIndicatorEnabled,
			activityLabelEnabled: global.activityLabelEnabled
		},
		override: selfOverride,
		inheritedFrom: selfOverride !== null ? "session" : "parent",
		compressionBrief: brief
	};
}
/** 从 compaction-log 汇总本会话的折叠简报（A 方案——浮窗常驻摘要行）。
*
*  过滤 = sessionKey 前缀匹配：日志里 sessionKey 是引擎写入的会话键
*  （`sk`，见 mbsf-core `_recordFold`），sessionId 是其组成部分——用
*  includes 而非全等，兼容键前缀形态（旧记录可能带 agent 前缀）。
*  全无命中 → null（浮窗显示「未折叠」而非「0 次」——未发生 ≠ 发生零次）。
*
*  [OBS] 上限 200 条（工程护栏：单会话折叠次数远小于此；超限只统计近 200
*  次，计数会低估——读取失败/无文件一律 null，不抛错、不阻塞开关面板）。 */
function sessionCompressionBrief(sessionId) {
	const entries = foldHistory$1(resolveMbsfDataDir(), 200);
	let folds = 0;
	let compressedTotal = 0;
	let archivedTotal = 0;
	let lastAt = 0;
	let lastMs = 0;
	let lastInputMessages = 0;
	for (const e of entries) {
		const key = e.sessionKey;
		if (typeof key !== "string" || !key.includes(sessionId)) continue;
		folds++;
		compressedTotal += e.compressed ?? 0;
		archivedTotal += e.archived ?? 0;
		if (e.ts > lastAt) {
			lastAt = e.ts;
			lastMs = e.elapsedMs ?? 0;
			lastInputMessages = e.inputMessages ?? 0;
		}
	}
	if (folds === 0) return null;
	return {
		folds,
		lastAt,
		lastMs,
		compressedTotal,
		archivedTotal,
		lastInputMessages
	};
}
//#endregion
//#region lib/types/session-reset.js
/**
* 会话重启调度（手动触发侧）
*
* 2026-09-20 一帆定「自动重启删掉」——**自动重置链已退役**（内存上限 + 回合末
* 自检 + 静默门 + 冷却 + 增长门槛 + goal 恢复注入全部删除）。本模块现在只剩
* **面板「重启 DSH」按钮**这一条触发路径：
*
*  - 本模块（进程内）：写一份请求文件并派一个**独立会话**的 runner
*    （`lib/bin/session-reset.js`）。
*  - runner（独立进程，DSH 关停不波及）：停 dsh → 清理（剥离 + 全库剪裁 +
*    备份清理 + 官方验证兜底还原）→ 起 dsh。
*
* 为什么退役自动重置：内存问题由**重启清理**解决——重启间隙是唯一全局静默
* 窗口，也是唯一能把磁盘收益转成内存收益的窗口（清理后 dsh 从小日志重载）。
* 自动重置的复杂度（多会话静默门、冷却、增长门槛、goal 恢复注入）换来的只是
* 「无人值守时也能瘦身」，而用户本来就要手动重启才看得到效果。
*
* @module mbsf-compaction/session-reset
*/
/** 请求文件路径（脑数据目录内，会话目录之外）。 */
/**
* 查出**本进程**（引擎跑在 host 进程内 ⟹ 就是 host）正在监听的 web 端口。
*
* 用 `lsof -a -p <pid> -iTCP -sTCP:LISTEN` 取本进程的 LISTEN 端口，排除进度页
* （3081）与本地网关（8790）之类非 web 面端口；取不到返回 undefined（调用方回退
* 到候选表）。
*/
function detectOwnWebPort() {
	try {
		const out = execFileSync("lsof", [
			"-a",
			"-p",
			String(process.pid),
			"-iTCP",
			"-sTCP:LISTEN",
			"-P",
			"-n"
		], { encoding: "utf8" });
		const ports = [];
		for (const line of out.split("\n").slice(1)) {
			const m = /:(\d+)\s*\(LISTEN\)/.exec(line);
			if (m === null) continue;
			const port = Number(m[1]);
			if (Number.isSafeInteger(port) && port > 0 && port !== 3081 && port !== 8790 && !ports.includes(port)) ports.push(port);
		}
		return ports[0];
	} catch {
		return;
	}
}
function resetRequestPath() {
	return join(resolveMbsfDataDir(), "session-reset-request.json");
}
/** 读请求文件；不存在/坏 JSON 返回 undefined。 */
function readResetRequest() {
	const path = resetRequestPath();
	if (!existsSync(path)) return void 0;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return;
	}
}
/** 清请求文件（幂等）。 */
function clearResetRequest() {
	try {
		rmSync(resetRequestPath(), { force: true });
	} catch {}
}
/** 陈旧阈值：请求写出后超过此时长仍未被 runner 消费，即视为陈旧。 */
/** [OBS] 请求文件陈旧阈值（30 分钟）——超过即视为 runner 没消费（崩溃/被杀），
*  清理掉防堆积。纯资源护栏，不参与剪裁判定。 */
const RESET_REQUEST_TTL_MS = 30 * 6e4;
/**
* 请求是否陈旧（写出后超过 TTL 仍未被消费）。
*
* 2026-09-14 加固（一帆「两条加固都做」）：陈旧请求是**静默死锁**——
* 两个调度入口（`shouldResetSessionLog` / `maybeScheduleRestart`）都以
* 「已有挂起请求 ⟹ 直接返回」为守卫，于是任何一次写成功但没跑起来的请求
* （09-10 副本缺 runner、09-14 stale 副本缺 runner）都会**永久堵死后续所有
* 重启与自动重置**，且毫无痕迹。TTL 让这种情况自愈。
*/
function isResetRequestStale(request, now = Date.now()) {
	return now - request.at > RESET_REQUEST_TTL_MS;
}
/**
* 读「新鲜」的挂起请求；陈旧则顺手清掉并返回 undefined（自愈，幂等）。
* 调度入口一律走本函数，不走裸 `readResetRequest`。
*/
function peekFreshResetRequest(now = Date.now()) {
	const request = readResetRequest();
	if (request === void 0) return void 0;
	if (isResetRequestStale(request, now)) {
		clearResetRequest();
		return;
	}
	return request;
}
/** spawn 失败报告路径（与 runner 报告同目录，便于一起看）。 */
function resetSpawnLogPath() {
	return join(resolveMbsfDataDir(), "session-reset-spawn-errors.log");
}
/** 本地时区 'YYYY-MM-DD HH:mm:ss'（2026-09-24 round 22：原 toISOString 恒
*  UTC——日志时间与本地差 8 小时；显示层一律本地时区）。 */
function _fmtLocalDateTimeSec(ts = Date.now()) {
	const d = new Date(ts);
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
/** 记一条 spawn 失败痕迹（spawn 是 detached + stdio ignore，出错会完全静默）。 */
function noteSpawnFailure(message) {
	try {
		mkdirSync(dirname(resetSpawnLogPath()), { recursive: true });
		writeFileSync(resetSpawnLogPath(), `[${_fmtLocalDateTimeSec()}] ${message}\n`, { flag: "a" });
	} catch {}
}
/**
* 派 runner（共用实现）。
*
* 2026-09-14 加固：spawn 用 `detached + stdio: 'ignore'`，失败**完全无痕**——
* 09-10 与 09-14 两次事故都是「请求写了、runner 没跑、日志一行没有」。这里
* 补三道可见性：① spawn 前查 runner 是否存在（两次事故的共同失败模式就是
* 文件不在）② spawn 抛错 ③ child 异步 'error' 事件。任一失败都记报告
* **并把请求清掉**（否则留下的请求会按上面的 TTL 逻辑堵死后续 30 分钟）。
*
* @returns 派生成功 true；失败 false（调用方应返回 undefined）。
*/
function spawnRunner() {
	const runner = resetRunnerPath();
	if (!existsSync(runner)) {
		noteSpawnFailure(`runner 不存在：${runner} ⟹ 请求已清，不阻塞后续`);
		clearResetRequest();
		return false;
	}
	try {
		const env = {
			...process.env,
			MBSF_HOST_ARGV: JSON.stringify(process.argv.slice(0, 8))
		};
		const child = spawn(process.execPath, [runner], {
			detached: true,
			stdio: "ignore",
			env
		});
		child.on("error", (error) => {
			noteSpawnFailure(`spawn 异步失败：${String(error)} ⟹ 请求已清`);
			clearResetRequest();
		});
		child.unref();
		return true;
	} catch (error) {
		noteSpawnFailure(`spawn 抛错：${String(error)} ⟹ 请求已清`);
		clearResetRequest();
		return false;
	}
}
/**
* runner 入口路径——**包内构建产物** `<lib>/bin/session-reset.js`。
*
* 2026-09-10 事故：原先指向 `<engine>/scripts/session-reset.mjs`，而 DSH 经
* profile 的 node_modules 副本加载引擎（`file:` 依赖复制），副本里只有包内
* 构建产物 ⟹ 派生路径不存在 ⟹ runner 静默不跑（请求写了、进程没动）。放进
* `src/bin/` 随构建落 `lib/bin/`，任何部署形态都在。
*/
function resetRunnerPath() {
	return join(dirname(fileURLToPath(import.meta.url)), "bin", "session-reset.js");
}
/**
* 面板「重启 DSH」按钮：写 restart 请求并派 runner。
*
* 清理与否由 `restartCleanupEnabled` 开关决定（runner 侧读）——本函数只负责
* 「派一次重启」。自动重置退役后这是**唯一**触发路径。
*/
function maybeScheduleRestart(input) {
	if (peekFreshResetRequest() !== void 0) return void 0;
	const ownWebPort = detectOwnWebPort();
	ensureHeapSnapshotDir();
	const request = {
		sessionId: input.sessionId,
		logPath: input.logPath ?? "",
		goalActive: false,
		logBytes: 0,
		ceilingMb: 0,
		...ownWebPort === void 0 ? {} : { webPort: ownWebPort },
		restart: {
			execPath: process.execPath,
			execArgv: withDshHeapFlags(process.execArgv),
			argv: [...process.argv.slice(1)],
			cwd: process.cwd()
		},
		source: "settings-button",
		mode: "restart",
		at: Date.now()
	};
	try {
		mkdirSync(dirname(resetRequestPath()), { recursive: true });
		writeFileSync(resetRequestPath(), `${JSON.stringify(request, null, 2)}\n`);
	} catch {
		return;
	}
	if (!spawnRunner()) return void 0;
	return request;
}
//#endregion
//#region lib/types/session-format-catalog-compat.js
/**
* 会话格式 catalog 双版本兼容层 —— engine 侧接触 DSH 存储格式的统一入口。
*
* ── 为什么需要（2026-09-26 App 版适配）─────────────────────────────────────
* 引擎同时要活在两个宿主里：
*   · CLI 0.1.5（`~/.dsh`）        → catalog 当前版本 = **v3**（`session.v3.jsonl`）
*   · App 0.1.7（`~/dsh-desktop-trial`）→ catalog 当前版本 = **v4**（`session.v4.jsonl`）
* 两边 catalog 包的 **API 形状不同**（2026-09-26 逐行比对两包 lib/index.js 实测）：
*
*   ┌──────────────────────┬──────────────────────┬────────────────────────────┐
*   │                      │ 0.1.5 catalog        │ 0.1.7 catalog              │
*   ├──────────────────────┼──────────────────────┼────────────────────────────┤
*   │ sessionFormatCatalog │ currentVersion = 3   │ currentVersion = 4         │
*   │ 读 v3 日志           │ ✅ current           │ ⚠️ migration-required，但  │
*   │                      │                      │    v3→v4 迁移要 children    │
*   │                      │                      │    证据（缺 → unsupported） │
*   │ historicalSession…   │ ❌ 无此导出          │ ✅ 读 v3 = current（完整）  │
*   │ 读 v4 日志           │ ❌ unsupported       │ ✅ current                 │
*   └──────────────────────┴──────────────────────┴────────────────────────────┘
*
* ── 取用策略：探测 + 兜底（零硬失败）──────────────────────────────────────
* 构建期 catalog 被 **内联** 进 bundle（tsdown 只 external 化 peerDependencies，
* 而 catalog 不在其中——实测 lib/index.js 无该 import）。内联副本 = 构建时
* 引擎 node_modules 里那份（CLI 场景 = 0.1.5）。
*
* 因此本层在**运行时探测宿主**是否有更新的 catalog（App 场景 pnpm 会把它装到
* 插件自己的 node_modules 下，因为 2026-09-26 起它进了 peerDependencies）：
*   · 探测成功且版本更高 → 用它（App：拿到 v4 能力）
*   · 探测失败/版本不高   → 用内联那份（CLI：行为与改动前完全一致）
* ⟹ **任何情况下都有可用 catalog，不存在「探测失败 → 引擎起不来」**。
*
* ── 读侧选法（按目标文件头）──────────────────────────────────────────────
*  1. `historicalSessionFormatCatalog`（0.1.7 独有）——current = v3，读 v3 是
*     「原生」路径，不需要 children 证据；
*  2. 宿主 catalog——0.1.5 下它就是 v3 原生；0.1.7 下是 v4（读 v4 靠它）。
*  判定用 `readHeader` 的 status：`current` / `migration-required` 都算可读
*  （与旧 `openLogReader` 同判据）；其余（unsupported / malformed）→ 换下一个。
*
* ── 写侧选法（按宿主 current，与读侧不同）────────────────────────────────
* 写侧产物要被**宿主**读回，所以必须跟宿主 currentVersion 走，而不是跟输入
* 文件版本走。0.1.5 宿主 → v3 行；0.1.7 宿主 → v4 行。
*
* ── 保守性（安全第一）────────────────────────────────────────────────────
* 探测失败/API 形状不认识 → 一律 null（调用方按「不可读/不可写」处理——跳过该
* 文件，绝不猜、绝不写坏）。读口 `decodeAll` 任一行失败 → null。
*/
function isCatalogLike(v) {
	if (v === null || typeof v !== "object") return false;
	const o = v;
	return typeof o["readHeader"] === "function" && typeof o["createRestore"] === "function" && typeof o["encodeCurrentHeader"] === "function" && typeof o["encodeCurrentEvent"] === "function" && typeof o["currentVersion"] === "number";
}
function asCatalog(v) {
	return isCatalogLike(v) ? v : null;
}
/**
* 探测基准列表：引擎自身 + **宿主进程 argv 里的路径**。
*
* ── 为什么不能只用 import.meta.url（2026-09-29 重启清理零产出根因）────────
* App 场景下引擎被装进 profile：`~/.dsh/profiles/desktop/node_modules/
* mbsf-compaction/`。`createRequire(import.meta.url)` 从那里
* 向上找 `@deepseek-ai/dsh-session-format-catalog`，会命中
* `~/.dsh/profiles/node_modules/` 下那份 —— 那是 **CLI 时代 0.1.5 的 v3-only
* 副本**。于是探测「成功」但拿到 v3，池里永远没有 v4 → App 自带的 v4 日志
* （最大的那批文件）一律读不出，重启清理 187 个文件全 skipped、释放 0 字节。
* 实测：`catalogProbeReport()` = { bundled: 3, probed: 3, effective: 3 }。
*
* 宿主的真身在 `process.argv` 里（App：`…/app.asar/dsh` 是 dsh root，
* `…/dsh-desktop-host/lib/index.js` 是宿主入口），从那解析才能拿到 App 自带的
* 0.1.7 / v4 catalog。逐个基准试，取 currentVersion **最大**的那份。
*/
function probeBases() {
	const out = [import.meta.url];
	const args = [...process.argv];
	const inherited = process.env.MBSF_HOST_ARGV;
	if (inherited !== void 0 && inherited !== "") try {
		const parsed = JSON.parse(inherited);
		if (Array.isArray(parsed)) {
			for (const a of parsed) if (typeof a === "string") args.push(a);
		}
	} catch {}
	for (const arg of args) {
		if (typeof arg !== "string" || !arg.startsWith("/")) continue;
		const isFile = /\.(m?js|cjs)$/.test(arg);
		out.push(isFile ? arg : `${arg.replace(/\/+$/, "")}/index.js`);
	}
	return out;
}
/**
* 运行时探测宿主 catalog 包（App 场景拿到 0.1.7 / v4）。
* 多基准逐个试，取 currentVersion 最大者；全部失败/形状不认识 → null。
*/
function probeHostCatalogPkg() {
	let best = null;
	let bestVersion = -1;
	for (const base of probeBases()) try {
		const mod = createRequire(base)("@deepseek-ai/dsh-session-format-catalog");
		if (mod === null || typeof mod !== "object") continue;
		const v = asCatalog(mod["sessionFormatCatalog"])?.currentVersion ?? -1;
		if (v > bestVersion) {
			best = mod;
			bestVersion = v;
		}
	} catch {}
	return best;
}
const bundledPkg = bundledCatalogPkg;
const probedPkg = probeHostCatalogPkg();
/** 内联（构建期）catalog 包。 */
const bundledHostCatalog = asCatalog(bundledPkg["sessionFormatCatalog"]);
/** 运行时探测到的 catalog 包（可能为 null）。 */
const probedHostCatalog = probedPkg === null ? null : asCatalog(probedPkg["sessionFormatCatalog"]);
(() => {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	const add = (cat, via) => {
		if (cat === null || seen.has(cat)) return;
		seen.add(cat);
		out.push({
			cat,
			via
		});
	};
	if (probedPkg !== null) add(asCatalog(probedPkg["historicalSessionFormatCatalog"]), "historical");
	add(probedHostCatalog, "host-probed");
	add(bundledHostCatalog, "host-bundled");
	return out.sort((a, b) => b.cat.currentVersion - a.cat.currentVersion);
})()[0]?.cat;
probedPkg === null || asCatalog(probedPkg["historicalSessionFormatCatalog"]);
constants.ZSTD_c_checksumFlag;
constants.ZSTD_e_flush;
/** 备份目录现状（份数 + 占用），用于设置页显示。 */
function backupDirStats(dir) {
	const out = {
		count: 0,
		bytes: 0
	};
	let names;
	try {
		names = readdirSync(dir);
	} catch {
		return out;
	}
	for (const name of names) try {
		const st = statSync(join(dir, name));
		if (!st.isFile()) continue;
		out.count += 1;
		out.bytes += st.size;
	} catch {}
	return out;
}
/** 两个备份目录的默认路径（脑数据目录内）。 */
function pruneBackupDirPath() {
	return join(resolveMbsfDataDir(), "prune-backups");
}
/** 剥离备份目录的默认路径。 */
function stripBackupDirPath() {
	return join(resolveMbsfDataDir(), "strip-backups");
}
//#endregion
//#region lib/types/cleanup.js
/**
* 重启清理统一入口（2026-09-20）
*
* **唯一触发点 = 重启间隙**（一帆 2026-09-20 定「不要启动剪的功能，只能重启
* 剪……最终都是重启后剪的效果才到内存里」）。本模块在 **runner 内、停 dsh
* 之后**执行，此时是唯一全局静默窗口：
*
*  - 没有会话在写 ⟹ 无需 mtime 门 / 租约锁探测（那些是「启动清理」在 dsh
*    进程内跑时才需要的活跃判据——随启动清理一并退役）
*  - 清理后 dsh 从小日志重载 ⟹ **磁盘收益与内存收益在此合一**（启动清理剪的
*    是磁盘，内存里的 `Session.events` 一份没少——对内存恒无效）
*
* 流程：剥离 stream → 剪裁日志（全库）→ 清理备份 → 官方验证（内联在剥离/
* 剪裁里）→ 统计落盘。每一步都逐文件独立——一个文件失败不影响其它文件。
*
* @module mbsf-compaction/cleanup
*/
/** 清理统计文件路径（只记最近一次，新覆盖旧）。 */
function cleanupStatsPath() {
	return join(resolveMbsfDataDir(), "cleanup-stats.json");
}
/** 读上次清理统计；无记录/损坏返回 undefined。 */
function readCleanupStats() {
	try {
		return JSON.parse(readFileSync(cleanupStatsPath(), "utf8"));
	} catch {
		return;
	}
}
//#endregion
//#region lib/types/trim-targets.js
/**
* 会话历史剪裁目标（`~/.mbsf/trim-targets.json`）+ 候选清单（2026-11-07）
*
* **语义（一帆 2026-11-07 定）**：
*  - 重启清理的粒度有两档：**全库**（设置页那个开关，管所有会话）和
*    **勾选集合**（本模块，只剪勾中的会话）。
*  - 两档冲突时**全库优先**——全局开关开着时勾选不生效（UI 会明确说这句）。
*    理由：一个开关必须只有一个意思，开关开着却"只剪一部分"会让人以为漏了。
*
* **为什么不复用 `sessions.json`（会话级配置覆盖）**：那张表是**继承链**语义
* （子会话没覆盖就继承父会话）。剪裁是**破坏性且不可恢复**的动作，绝不能
* 因为父会话被勾了就顺带把子会话剪掉——所以用独立文件、字面 id 精确匹配、
* 零继承。
*
* 文件形状（append 语义无关，整表覆盖写；损坏即视为空表，不阻断重启）：
* ```json
* { "version": 1, "targets": { "<sessionId>": { "selected": true, "updatedAt": "…" } } }
* ```
*
* @module mbsf-compaction/trim-targets
*/
/** 勾选表路径（脑数据目录下）。 */
function trimTargetsPath() {
	return join(resolveMbsfDataDir(), "trim-targets.json");
}
/** 读整张勾选表；文件缺失/损坏 → 空表（**不抛**——坏文件不该挡住重启）。 */
function loadTrimTargets() {
	try {
		const targets = JSON.parse(readFileSync(trimTargetsPath(), "utf8")).targets;
		if (targets === null || typeof targets !== "object") return {};
		const out = {};
		for (const [id, value] of Object.entries(targets)) {
			if (value === null || typeof value !== "object") continue;
			const selected = value.selected;
			if (typeof selected !== "boolean") continue;
			const updatedAt = value.updatedAt;
			out[id] = {
				selected,
				updatedAt: typeof updatedAt === "string" ? updatedAt : ""
			};
		}
		return out;
	} catch {
		return {};
	}
}
/** 写整张勾选表（失败抛——UI 需要知道没写进去）。 */
function saveTrimTargets(targets) {
	const p = trimTargetsPath();
	mkdirSync(dirname(p), { recursive: true });
	writeFileSync(p, `${JSON.stringify({
		version: 1,
		targets
	}, null, 2)}\n`);
}
/**
* 移除若干会话的勾选记录（删除会话时调用）。
*
* 为什么删除要清勾选：``trim-targets.json`` 是**独立表**，删掉的会话不会再出现在
* 清单里，它的勾选记录就成了幽灵——「已勾 3 个会话」里有一个根本不存在，重启时
* 剪裁器按 id 找不到日志只能跳过（多打一条 warn）。让删除顺手把记录清掉。
*/
function removeTrimTargets(ids) {
	if (ids.length === 0) return;
	const targets = loadTrimTargets();
	let changed = false;
	for (const id of ids) if (id in targets) {
		delete targets[id];
		changed = true;
	}
	if (changed) saveTrimTargets(targets);
}
/** 设置一个会话的勾选状态；返回改后的状态。 */
function setTrimTarget(sessionId, selected) {
	const id = sessionId.trim();
	if (id === "") throw new Error("setTrimTarget: empty session id");
	const targets = loadTrimTargets();
	const state = {
		selected,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	targets[id] = state;
	saveTrimTargets(targets);
	return state;
}
/** 一个会话目录下可能的日志文件名（形态与扫描器一致）。 */
const LOG_NAMES = [
	"session.v4.jsonl.zstd",
	"session.v3.jsonl.zstd",
	"session.jsonl.zstd",
	"session.v4.jsonl",
	"session.v3.jsonl",
	"session.jsonl"
];
/**
* 会话目录名 → 可读路径（DSH 把非 ASCII 转义成 `~XXXX~`，UTF-16 码元十六进制）。
*
* ⚠️ **相邻转义共用波浪线**：`~663E~793A~5F15~` 里每个 `~` 既是上一个转义的
* 收尾又是下一个的开头（实测目录名 `MBSF~663E~793A~5F15~64CE`）。所以正则
* **不能**写成 `~([0-9A-Fa-f]{4})~`——那样会跳着匹配，一串汉字只剩首尾两个
* 被解码（"未5FC5科5E7B" 这种半残结果）。正确形状 = `~XXXX` 无尾波浪线，
* 剩下的孤立尾 `~` 最后统一剥掉。
*/
function decodeWorkspaceDirName(name) {
	return `/${name.replace(/^--/, "").replace(/--$/, "").replace(/~([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))).replace(/-/g, "/").replace(/\/$/, "")}`;
}
/**
* 读会话头（**只解压第一帧**，不解整份日志）。
*
* 实测（2026-11-07）：DSH 的 v4 日志第一帧就是那行 `{"type":"session",…}` 头，
* 几十到几百字节；后面的帧才是事件。所以读头是便宜的——**标题读不了**（首条
* 用户消息落在第一帧之后，要拿它就得解整份日志，大文件几百 MB），这是刻意
* 取舍：清单用「工作区 + 短 id + 大小 + 时间」辨认，不为标题付解压代价。
*/
function readSessionHeader(path) {
	let fd;
	try {
		fd = openSync(path, "r");
		const total = statSync(path).size;
		let window = Math.min(64 * 1024, total);
		let text = "";
		while (window > 0 && window <= HEADER_MAX_BYTES) {
			const buffer = Buffer.allocUnsafe(window);
			const got = readSync(fd, buffer, 0, window, 0);
			if (got < 8) return {};
			const head = buffer.subarray(0, got);
			const frames = scanCompleteFrames(head);
			let consumed = 0;
			for (const frame of frames) {
				if (frame.end > got) break;
				try {
					text += zstdDecompressSync(head.subarray(frame.start, frame.end)).toString("utf8");
				} catch {
					break;
				}
				consumed = frame.end;
				if (text.includes("\n")) break;
			}
			if (text.includes("\n")) break;
			if (consumed > 0) return {};
			if (window >= HEADER_MAX_BYTES) return {};
			window = Math.min(window * 2, HEADER_MAX_BYTES);
		}
		const firstLine = text.split("\n")[0];
		if (firstLine === void 0 || firstLine === "") return {};
		const header = JSON.parse(firstLine);
		if (header["type"] !== "session") return {};
		const out = {};
		if (typeof header["cwd"] === "string") out.cwd = header["cwd"];
		if (typeof header["createdAt"] === "number") out.createdAt = header["createdAt"];
		if (typeof header["origin"] === "string") out.origin = header["origin"];
		if (typeof header["parentSession"] === "string") out.parentSession = header["parentSession"];
		return out;
	} catch {
		return {};
	} finally {
		if (fd !== void 0) try {
			closeSync(fd);
		} catch {}
	}
}
/** 读会话头的窗口上限（工程边界——子代理首帧实测最大 ~几百 KB）。 */
const HEADER_MAX_BYTES = 2 * 1024 * 1024;
/** 读标题的预算（工程边界——不是判定参数）。 */
const TITLE_FIRST_CHUNK = 256 * 1024;
const TITLE_MAX_BYTES = 2 * 1024 * 1024;
const TITLE_MAX_FRAMES = 80;
/** 标题截断长度（字符）——够辨认，不抢版面。 */
const TITLE_MAX_CHARS = 60;
/** 标题缓存（key = 路径 + mtime + size；条目越界按插入序淘汰）。 */
const _titleCache = /* @__PURE__ */ new Map();
const TITLE_CACHE_CAP = 600;
/** 把首条用户消息压成一行短标题（换行/连续空白压缩，超长截断加省略号）。 */
function toTitle(text) {
	const flat = normalizeWs(text);
	if (flat === "") return void 0;
	const stripped = flat.replace(/^(?:<[^>]{1,40}>\s*)+/u, "");
	const body = stripped === "" ? flat : stripped;
	return body.length > TITLE_MAX_CHARS ? `${body.slice(0, TITLE_MAX_CHARS)}…` : body;
}
/**
* 读会话标题（= 首条用户消息的前若干字符）。
*
* **为什么不是「读整个日志再取第一条」**：实测有几百 MB 的会话日志，而首条用户
* 消息几乎总在最前面几帧。所以按块读：先 256 KB，不够再按 256 KB 追加（总预算
* 2 MB / 80 帧封顶），拿到第一条就停。**放弃 = 返回 undefined**（空会话、首条不是
* 文本、或预算内没找到）——清单宁可少一列信息，也不能为了标题把设置页拖住。
*
* 结果按 `路径|mtime|size` 缓存在进程内：切筛选/排序/重开设置页都不会重复解压。
* 日志被追加（mtime/size 变）则缓存自然失效。
*/
/**
* 扫出**完整**的 zstd 帧边界，容忍尾部半帧。
*
* `scanZstdFrameBounds` 遇到「块头说要 N 字节、缓冲只剩 N-k」会抛
* `corrupt zstd log: truncated block payload`。按块读日志时最后几乎总有一帧被
* 切断——第一版直接把异常吞成「读不到标题」，实测 200 个会话里 127 个因此没有
* 标题。这里逐级缩小前缀重扫，拿到「能完整解析的那一段」为止；尾部那半帧留给
* 下一轮从 `pos` 重新读（所以丢掉的字节不会真丢）。
*/
function scanCompleteFrames(buffer) {
	for (let ratio = 1; ratio >= .2; ratio -= .2) {
		const length = Math.floor(buffer.length * ratio);
		if (length < 8) break;
		try {
			return scanZstdFrameBounds(buffer.subarray(0, length));
		} catch {
			continue;
		}
	}
	return [];
}
function readSessionTitle(path, mtimeMs, bytes) {
	const key = `${path}|${String(mtimeMs)}|${String(bytes)}`;
	if (_titleCache.has(key)) return _titleCache.get(key);
	let title;
	let fd;
	try {
		fd = openSync(path, "r");
		let text = "";
		let frames = 0;
		let pos = 0;
		let window = Math.min(TITLE_FIRST_CHUNK, bytes);
		while (pos < bytes && pos < TITLE_MAX_BYTES && window > 0) {
			const len = Math.min(window, bytes - pos);
			const buf = Buffer.allocUnsafe(len);
			const got = readSync(fd, buf, 0, len, pos);
			if (got <= 0) break;
			const head = buf.subarray(0, got);
			const bounds = scanCompleteFrames(head);
			let consumed = 0;
			for (const frame of bounds) {
				if (frame.end > got) break;
				frames += 1;
				if (frames > TITLE_MAX_FRAMES) break;
				let chunk = "";
				try {
					chunk = zstdDecompressSync(head.subarray(frame.start, frame.end)).toString("utf8");
				} catch {
					break;
				}
				consumed = frame.end;
				text += chunk;
				const first = extractLogMessages(text).find((message) => message.role === "user");
				if (first !== void 0) {
					title = toTitle(first.text);
					break;
				}
			}
			if (title !== void 0) break;
			if (consumed === 0) {
				if (window >= TITLE_MAX_BYTES) break;
				window = Math.min(window * 2, TITLE_MAX_BYTES);
				continue;
			}
			pos += consumed;
			window = Math.min(TITLE_FIRST_CHUNK, Math.max(bytes - pos, 0));
		}
	} catch {
		title = void 0;
	} finally {
		if (fd !== void 0) try {
			closeSync(fd);
		} catch {}
	}
	_titleCache.set(key, title);
	if (_titleCache.size > TITLE_CACHE_CAP) {
		const oldest = _titleCache.keys().next().value;
		if (oldest !== void 0) _titleCache.delete(oldest);
	}
	return title;
}
/**
* 给每行补上谱系位置（根源 id / 根源是否归档 / 是否孤儿）。
*
* 为什么需要：DSH 的归档集合只记「这一条会话」归档了没有，**子代理不随主会话
* 归档**（2026-11-07 实测）。于是「这个子代理属于一个已经关掉的对话」只能靠
* 沿 `parentSession` 往上找根、再看根的归档位。删除资格、归档筛选都要用这条
* 结论，所以在这里一次算清，别让下游各自拼。
*
* 链断（父会话已不在盘上）= 孤儿：它不再挂在任何活对话下面，可删。
* 环（A 的父是 B、B 的父是 A）= 同样按坏链处理，宁可判成孤儿也不死循环。
*/
function annotateTrimLineage(rows) {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const cache = /* @__PURE__ */ new Map();
	const resolve = (start) => {
		const walked = [];
		const seen = /* @__PURE__ */ new Set();
		let current = start;
		let result;
		for (;;) {
			const cached = cache.get(current.id);
			if (cached !== void 0) {
				result = cached;
				break;
			}
			if (seen.has(current.id)) {
				result = {
					rootId: current.id,
					rootArchived: false,
					orphan: true
				};
				break;
			}
			seen.add(current.id);
			walked.push(current.id);
			const parentId = current.parentSession;
			if (parentId === void 0) {
				result = {
					rootId: current.id,
					rootArchived: current.archived,
					orphan: false
				};
				break;
			}
			const parent = byId.get(parentId);
			if (parent === void 0) {
				result = {
					rootId: current.id,
					rootArchived: false,
					orphan: true
				};
				break;
			}
			current = parent;
		}
		for (const id of walked) cache.set(id, result);
		return result;
	};
	return rows.map((row) => {
		const lineage = resolve(row);
		return {
			...row,
			rootId: lineage.rootId,
			rootArchived: lineage.rootArchived,
			orphan: lineage.orphan
		};
	});
}
/**
* 列出可剪裁的会话（设置页清单的数据源）。
*
* **上限**：按 mtime 倒序取前 `limit` 个（默认 500，2026-11-07 从 200 上调）。
*
* 为什么上调：清单现在不只用来勾剪裁，还是**会话管理面**——子代理会话要能被
* 筛出来、已归档的要能删。200 会悄悄漏掉一部分（实测盘上 239 个），而「列表里
* 没有」和「库里没有」在界面上分不开。实测 238 个全量冷读 855ms，缓存后秒回。
*/
function listTrimCandidates(dshHome, limit = 500, archivedIds = /* @__PURE__ */ new Set()) {
	const sessionsRoot = join(dshHome, "sessions");
	let workspaces;
	try {
		workspaces = readdirSync(sessionsRoot);
	} catch {
		return [];
	}
	const targets = loadTrimTargets();
	const rows = [];
	for (const workspace of workspaces) {
		let sessionDirs;
		try {
			sessionDirs = readdirSync(join(sessionsRoot, workspace));
		} catch {
			continue;
		}
		for (const id of sessionDirs) {
			const directory = join(sessionsRoot, workspace, id);
			let logPath;
			let stat;
			for (const name of LOG_NAMES) {
				const candidate = join(directory, name);
				if (!existsSync(candidate)) continue;
				try {
					const st = statSync(candidate);
					logPath = candidate;
					stat = {
						size: st.size,
						mtimeMs: st.mtimeMs
					};
					break;
				} catch {
					continue;
				}
			}
			if (logPath === void 0 || stat === void 0) continue;
			const header = readSessionHeader(logPath);
			const title = readSessionTitle(logPath, stat.mtimeMs, stat.size);
			rows.push({
				id,
				workspace,
				workspacePath: header.cwd ?? decodeWorkspaceDirName(workspace),
				logPath,
				sessionDir: directory,
				archived: archivedIds.has(id),
				bytes: stat.size,
				mtimeMs: stat.mtimeMs,
				selected: targets[id]?.selected === true,
				...header.createdAt === void 0 ? {} : { createdAtMs: header.createdAt },
				...header.origin === void 0 ? {} : { origin: header.origin },
				...header.parentSession === void 0 ? {} : { parentSession: header.parentSession },
				...title === void 0 ? {} : { title }
			});
		}
	}
	rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return annotateTrimLineage(rows).slice(0, limit);
}
const DAY_MS = 1440 * 60 * 1e3;
/**
* 会话 id 的安全形态：字母数字开头，只允许 `[A-Za-z0-9._-]`。
*
* 为什么校验而不是直接拼路径：id 来自**磁盘目录名**，而目录名是可被伪造的输入
* （手工放进来的目录、同步工具造出的怪名字）。`..` 一旦混进去，删除就变成对
* 任意路径的移动。
*/
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** 工作区目录名的安全形态：DSH 用 `-` 分隔、`~XXXX~` 转义非 ASCII，首字符常是 `-`（`--Users-…--`）。 */
const SAFE_WORKSPACE_DIR = /^[A-Za-z0-9._~-]+$/;
/** 回收站根目录（默认 `~/.mbsf/deleted-sessions`）。 */
function deletedRoot(base) {
	return join(base ?? resolveMbsfDataDir(), "deleted-sessions");
}
/** 校验一段路径片段，拒绝一切可能穿越目录的形态。 */
function assertSegment(value, what, pattern) {
	if (typeof value !== "string" || value === "" || !pattern.test(value)) throw new Error(`deleted-sessions: 非法的${what}「${String(value)}」`);
	return value;
}
/** `target` 必须严格位于 `root` 之下（含自身直接子项）。 */
function assertInside(root, target) {
	const base = resolve(root);
	const full = resolve(target);
	if (full !== base && !full.startsWith(base + sep)) throw new Error(`deleted-sessions: 路径越界 ${full}`);
}
/** 备份目录里「会话本体」的位置。 */
function payloadPath(backupDir) {
	return join(backupDir, "payload");
}
/** 元数据路径。 */
function metaPath(backupDir) {
	return join(backupDir, "meta.json");
}
/** 搬目录：同卷 rename（原子）；跨卷（EXDEV）退化为 copy + rm。 */
function moveDir(from, to) {
	try {
		renameSync(from, to);
	} catch (error) {
		if (error.code !== "EXDEV") throw error;
		cpSync(from, to, {
			recursive: true,
			preserveTimestamps: true
		});
		rmSync(from, {
			recursive: true,
			force: true
		});
	}
}
/** 目录大小（递归，只用于显示与统计；失败按 0 计）。 */
function dirBytes(dir) {
	let total = 0;
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true }).map((entry) => entry.name);
	} catch {
		return 0;
	}
	for (const name of entries) {
		const full = join(dir, name);
		try {
			const st = statSync(full);
			total += st.isDirectory() ? dirBytes(full) : st.size;
		} catch {
			continue;
		}
	}
	return total;
}
/**
* 删除一批会话（父会话 + 名下子代理），搬到回收站。
*
* **全有或全无**：任一项搬失败 → 已搬的回滚（搬回原位）、备份目录清掉、抛错。
* 半删状态比删失败更危险——用户看到「没删成」，实际少了一半会话。
*/
function deleteSessions(dshHome, items, options = {}) {
	if (items.length === 0) throw new Error("deleted-sessions: 没有要删除的会话");
	const root = deletedRoot(options.root);
	const now = options.now ?? Date.now();
	const sessionsRoot = join(dshHome, "sessions");
	const id = randomUUID();
	const deletedAt = new Date(now).toISOString();
	const expiresAt = new Date(now + 30 * DAY_MS).toISOString();
	const moved = [];
	let bytes = 0;
	try {
		for (const item of items) {
			const sessionId = assertSegment(item.id, "会话 id", SAFE_ID);
			const workspaceDir = assertSegment(item.workspaceDir, "工作区目录名", SAFE_WORKSPACE_DIR);
			const expected = join(sessionsRoot, workspaceDir, sessionId);
			if (resolve(item.sessionDir) !== resolve(expected)) throw new Error(`deleted-sessions: 会话目录不在规范位置（${item.sessionDir}）`);
			if (!existsSync(expected)) throw new Error(`deleted-sessions: 会话目录不存在（${expected}）`);
			const backupDir = join(root, sessionId);
			assertInside(root, backupDir);
			if (existsSync(backupDir)) throw new Error(`deleted-sessions: 已有同 id 的备份（${sessionId}）`);
			const size = dirBytes(expected);
			mkdirSync(backupDir, { recursive: true });
			const meta = {
				version: 1,
				id: sessionId,
				batchId: id,
				role: item.role,
				siblings: [...item.siblings],
				...item.title === void 0 ? {} : { title: item.title },
				workspacePath: item.workspacePath,
				workspaceDir,
				...item.origin === void 0 ? {} : { origin: item.origin },
				...item.parentSession === void 0 ? {} : { parentSession: item.parentSession },
				bytes: size,
				deletedAt,
				expiresAt,
				status: "pending"
			};
			writeFileSync(metaPath(backupDir), `${JSON.stringify(meta, null, 2)}\n`);
			const target = payloadPath(backupDir);
			moveDir(expected, target);
			moved.push({
				from: expected,
				to: target
			});
			writeFileSync(metaPath(backupDir), `${JSON.stringify({
				...meta,
				status: "ready"
			}, null, 2)}\n`);
			bytes += size;
		}
	} catch (error) {
		for (const entry of [...moved].reverse()) try {
			if (existsSync(entry.to) && !existsSync(entry.from)) moveDir(entry.to, entry.from);
		} catch {}
		for (const item of items) {
			const backupDir = join(root, item.id);
			try {
				if (existsSync(backupDir) && !existsSync(payloadPath(backupDir))) rmSync(backupDir, {
					recursive: true,
					force: true
				});
			} catch {}
		}
		throw error;
	}
	return {
		batchId: id,
		ids: items.map((item) => item.id),
		bytes
	};
}
/** 读一条备份的元数据（坏文件 → undefined，不抛）。 */
function readMeta(backupDir) {
	try {
		const raw = JSON.parse(readFileSync(metaPath(backupDir), "utf8"));
		if (raw === null || typeof raw !== "object") return void 0;
		if (typeof raw.id !== "string" || raw.id === "") return void 0;
		if (typeof raw.expiresAt !== "string" || Number.isNaN(Date.parse(raw.expiresAt))) return void 0;
		if (typeof raw.workspaceDir !== "string" || typeof raw.workspacePath !== "string") return void 0;
		return raw;
	} catch {
		return;
	}
}
/**
* 列出回收站（**顺手清理到期项**）。
*
* 清理时机故意只放在「打开列表」这一处：用户能看见的东西才有明确的因果
* （「我打开列表 → 提示永久清理了 N 项」），没有后台统一删除。
*/
function listDeleted(options = {}) {
	const root = deletedRoot(options.root);
	const now = options.now ?? Date.now();
	let names;
	try {
		names = readdirSync(root);
	} catch {
		return {
			entries: [],
			purged: 0,
			ignored: 0
		};
	}
	const entries = [];
	let purged = 0;
	let ignored = 0;
	for (const name of names) {
		const backupDir = join(root, name);
		let isDir = false;
		try {
			isDir = statSync(backupDir).isDirectory();
		} catch {
			continue;
		}
		if (!isDir) continue;
		const meta = readMeta(backupDir);
		const hasPayload = existsSync(payloadPath(backupDir));
		if (meta === void 0) {
			ignored += 1;
			continue;
		}
		if (!hasPayload) {
			ignored += 1;
			continue;
		}
		const expires = Date.parse(meta.expiresAt);
		if (now >= expires) {
			try {
				rmSync(backupDir, {
					recursive: true,
					force: true
				});
				purged += 1;
			} catch {
				ignored += 1;
			}
			continue;
		}
		entries.push({
			...meta,
			remainingDays: Math.max(0, Math.ceil((expires - now) / DAY_MS))
		});
	}
	entries.sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
	return {
		entries,
		purged,
		ignored
	};
}
/**
* 恢复一条（父会话恢复时**整批恢复**它带走的子代理）。
*
* 恢复前检查目标位置：原目录已存在 → 拒绝（**绝不覆盖**——那可能是用户新建的
* 同名会话，或另一份数据）。子代理恢复失败不回滚父会话（父回来是主诉求），
* 失败的留在回收站里下次再试。
*/
function restoreDeleted(dshHome, id, options = {}) {
	const root = deletedRoot(options.root);
	const now = options.now ?? Date.now();
	const sessionsRoot = join(dshHome, "sessions");
	const primaryDir = join(root, assertSegment(id, "会话 id", SAFE_ID));
	assertInside(root, primaryDir);
	const meta = readMeta(primaryDir);
	if (meta === void 0) throw new Error("deleted-sessions: 找不到该会话的删除记录");
	if (!existsSync(payloadPath(primaryDir))) throw new Error("deleted-sessions: 备份里没有会话本体");
	if (now >= Date.parse(meta.expiresAt)) throw new Error("deleted-sessions: 已超过 30 天保留期");
	const order = [meta.id, ...meta.siblings];
	const restored = [];
	for (const sessionId of order) {
		const backupDir = join(root, sessionId);
		assertInside(root, backupDir);
		if (!existsSync(backupDir)) continue;
		const itemMeta = readMeta(backupDir) ?? meta;
		if (!existsSync(payloadPath(backupDir))) continue;
		const target = join(sessionsRoot, assertSegment(itemMeta.workspaceDir, "工作区目录名", SAFE_WORKSPACE_DIR), sessionId);
		if (existsSync(target)) {
			if (sessionId === meta.id) throw new Error(`deleted-sessions: 原位置已有同名会话（${target}）`);
			continue;
		}
		mkdirSync(dirname(target), { recursive: true });
		moveDir(payloadPath(backupDir), target);
		restored.push(sessionId);
		try {
			rmSync(backupDir, {
				recursive: true,
				force: true
			});
		} catch {}
	}
	return { restored };
}
//#endregion
//#region lib/types/dsh-workspace-state.js
/**
* 读 DSH 自己的工作区状态（**只读**，2026-11-07）
*
* 会话管理面要按 DSH 的规则筛选（已归档 / 子代理），而「已归档」是 DSH 自己的
* 概念，不存在会话日志里——它只存在于工作区注册表的状态：
*
* ```text
* ~/.dsh/storages/workspace.json
*   global.archivedSessionIds: string[]      ← 归档集合（注册表全局，不分工作区）
*   tables.workspaces[<id>].sessionIds: []   ← 各工作区记账的会话
* ```
*
* **为什么还要读文件**：宿主运行时 `ctx.workspaceRegistry.archivedSessionIds`
* 才是权威（内存态、即时）；这个文件是它的持久化影子。网关优先问注册表，拿不到
* （服务不在 / 老版本）再读文件。两条路都给同一份信息，读文件是兜底不是主路。
*
* **容错**：文件缺失或损坏 → 空集合。归档状态读不到时，界面上「归档」筛选会
* 全部显示为未归档——这是**降级显示**，不是把任何会话当成已归档；删除判据里
* 归档只影响「能不能删」的一条分支，宁严不松（见 status-gateway 的判定）。
*
* @module mbsf-compaction/dsh-workspace-state
*/
/** 工作区状态文件路径。 */
function workspaceStatePath(dshHome) {
	return join(dshHome, "storages", "workspace.json");
}
/** 从磁盘读归档集合；读不到 → 空集合（**不抛**——状态文件坏了不该挡住清单）。 */
function readArchivedSessionIds(dshHome) {
	try {
		const list = JSON.parse(readFileSync(workspaceStatePath(dshHome), "utf8")).global?.archivedSessionIds;
		if (!Array.isArray(list)) return /* @__PURE__ */ new Set();
		return new Set(list.filter((id) => typeof id === "string" && id !== ""));
	} catch {
		return /* @__PURE__ */ new Set();
	}
}
//#endregion
//#region lib/types/status-gateway.js
/**
* 未必记忆状态服务（插件条目 `mbsf-status`，exports ./status）
*
* 把未必记忆运行状态暴露给浏览器半（设置 → 「未必记忆」状态页）与任何
* Typert Remote 客户端：足迹 / 记忆索引 / 压缩统计 / 内容段 / 注入 /
* 回想。数据源全部是引擎内现成的 stats 快照函数——本网关只做汇总与
* 装配，不持有任何独立状态。
*
* 装配：bundle patch（cordis.patch.yml）插入一条
*   - id: mbsf-status
*     name: 'mbsf-compaction/status'
* 客户端经 `ctx.remote.mbsfStatus.snapshot()` 懒调用。
*
* 端点注册方式（2026-08-25 vendor 化后修正）：
* 不再用 @Remote 装饰器 + TypertRemoteService 基类——装饰器把标记写进
* dsh-typert-protocol 模块私有的 markers WeakMap，而本插件经 vendor 副本
* 解析该包（engine/node_modules → vendor/dsh），gateway 从 workspace 原件
* 读取，同一进程内两个模块实例 → 标记互相隔离 → 端点 404。
* 改为 `ctx.typert.register()` 显式注册 strict contribution（registry 官方
* 支持的手写路径，loader 注释明示），端点在主 registry 立即可见，与
* vendor/workspace 模块身份彻底无关。result 用透传 schema（parse 原样
* 返回），与 ui 侧 mbsf-remote.ts 的 client 契约完全对称。
*
* @module mbsf-compaction/status
*/
const require = createRequire(import.meta.url);
/** 解析包版本：经 exports "./package.json" 从包根读（src/ 与 lib/types/ 两处编译位置都稳）。 */
function readVersion() {
	try {
		const pkgRoot = join(require.resolve("mbsf-compaction/package.json"), "..");
		return require(join(pkgRoot, "package.json")).version ?? "unknown";
	} catch {
		return "unknown";
	}
}
/**
* 透传 schema 工厂（strict codec 的 `create` 槽位）。
*
* ⚠️ 双版本 codec 形状（2026-09-26 App 版适配实测）：
*  · 0.1.5 `validateCodec` 要求 `codec.schema.parse` 是函数；
*  · 0.1.7 `validateCodec` 要求 **`codec.create` 是函数**（惰性 schema 工厂，
*    registry 消费处 `record.value ??= record.create()`——只在首次物化时调）。
* 两版都不看另一个槽位，所以**两个都放**即可双向兼容。`create` 返回一个
* 「原样透传」的 schemastery 对象（parse 恒等），保留既有宽松语义：
* 不校验 wire 形状、快照结构演进免同步。
*/
function passthroughSchemaFactory() {
	return { parse: (value) => value };
}
/**
* 快照端点的显式 contribution（等价生成器对 `@Remote('snapshot') snapshot()`
* 的产出）。id/service/namespace/method 与 ui 侧 mbsf-remote.ts 的
* TYPERT_REMOTE 一字不差；result 用 strict + 透传 schema（parse 原样返回），
* 保留「不校验 wire 形状、快照结构演进免同步」的宽松语义。
*/
const SNAPSHOT_INVOCATIONS = [{
	id: "mbsf-compaction#mbsfStatus/snapshot",
	service: "mbsfStatus",
	namespace: "mbsfStatus",
	method: "snapshot",
	invocation: { kind: "direct" },
	parameters: [],
	result: {
		mode: "strict",
		typeSymbol: "mbsf-compaction/types#MbsfStatusSnapshot",
		schema: { parse: (value) => value },
		create: passthroughSchemaFactory
	}
}];
/** 重启结果的 strict codec（透传）。 */
const RESTART_RESULT_CODEC = {
	mode: "strict",
	typeSymbol: "mbsf-compaction/types#MbsfRestartResult",
	schema: { parse: (value) => value },
	create: passthroughSchemaFactory
};
/** 释放内存结果的 strict codec（透传）。 */
const RECLAIM_RESULT_CODEC = {
	mode: "strict",
	typeSymbol: "mbsf-compaction/types#MbsfReclaimResult",
	schema: { parse: (value) => value },
	create: passthroughSchemaFactory
};
/** 会话 id 的 strict 参数 codec（透传——client api 强制 strict，语义仍宽松）。 */
const SESSION_ID_CODEC = {
	mode: "strict",
	typeSymbol: "mbsf-compaction/types#SessionId",
	schema: { parse: (value) => value },
	create: passthroughSchemaFactory
};
/** 会话覆盖入参的 strict 参数 codec（透传）。 */
const SESSION_OVERRIDE_CODEC = {
	mode: "strict",
	typeSymbol: "mbsf-compaction/types#SessionOverride",
	schema: { parse: (value) => value },
	create: passthroughSchemaFactory
};
/** 会话配置结果的 strict codec（透传）。 */
const SESSION_CONFIG_RESULT_CODEC = {
	mode: "strict",
	typeSymbol: "mbsf-compaction/types#SessionConfigState",
	schema: { parse: (value) => value },
	create: passthroughSchemaFactory
};
/**
* 删除资格（唯一口径，2026-11-07 一帆定，同日第二版）。
*
* 第一版把「子代理会话」当成天然可删——**错在前提**：以为归档主会话会连子代理
* 一起归档。实测不是（归档集合里只有主会话 id），于是「父会话还开着」的子代理
* 也亮了垃圾桶，删掉就等于把活对话的子代理历史挖掉一块。
*
* 现在的规则——可删 = **这个会话所属的对话已经关闭**：
*
* - 自身已归档 → 可删（用户亲手做过「不要了」这一步）；
* - **根源会话已归档** → 可删（整棵树属于一个已关闭的对话，含子代理）；
* - **孤儿**（父会话已不在盘上）→ 可删（不挂在任何活对话下面，是残留）；
* - 其余不可删：主会话给 `active`（先归档），子代理给 `parent`（父会话还没归档）。
*
* 不管哪一类，**内存里活着的**（正在跑 / 正开着）一律不可删。
*
* 为什么要先归档：删除有 30 天备份，但归档是零成本、可即时撤销的「我确定不要
* 它了」声明。让这两步分开，误删的门槛就从「点错按钮」变成「连着点错两次」。
*/
function trimDeletable(row, live) {
	if (!(row.archived || row.rootArchived === true || row.orphan === true)) return {
		deletable: false,
		reason: row.parentSession === void 0 ? "active" : "parent"
	};
	if (live) return {
		deletable: false,
		reason: "live"
	};
	return { deletable: true };
}
/** 清单结果。 */
/**
* 引擎行 → 线上行（**逐字段搬运**）。
*
* ⚠️ 这一层曾经漏过 `title`（2026-11-07 第三次「改了没生效」）：字段在引擎里算出来了，
* 客户端也渲染了，中间这个映射却只 copy 了它认识的字段 ⟹ 界面上静默消失。
* 抽成纯函数 + 回归测试，就是为了让「新增字段忘了搬」变成红灯而不是无声。
*/
function toTrimRow(row, lastTrim, live = false) {
	const door = trimDeletable(row, live);
	return {
		id: row.id,
		...row.title === void 0 ? {} : { title: row.title },
		workspacePath: row.workspacePath,
		bytes: row.bytes,
		mtimeMs: row.mtimeMs,
		selected: row.selected,
		archived: row.archived,
		...row.parentSession === void 0 ? {} : { parentSession: row.parentSession },
		rootArchived: row.rootArchived === true,
		orphan: row.orphan === true,
		deletable: door.deletable,
		...door.reason === void 0 ? {} : { deletableReason: door.reason },
		lastTrim,
		...row.createdAtMs === void 0 ? {} : { createdAtMs: row.createdAtMs },
		...row.origin === void 0 ? {} : { origin: row.origin }
	};
}
/** DSH 家目录（宿主与插件共用同一份数据；测试可覆盖环境变量）。 */
function dshHomePath() {
	return process.env.DSH_HOME ?? join(process.env.HOME ?? "", ".dsh");
}
/**
* 某会话的**全部后代**（子代理会话，含孙代）。
*
* 删除父会话要把整棵子树带走：只带直接子会话的话，孙代目录会变成更深的孤儿
* （父和子都不在了，它自己还占着盘，且永远没人能恢复它的父）。
*/
function descendantsOf(rows, id) {
	const byParent = /* @__PURE__ */ new Map();
	for (const row of rows) {
		if (row.parentSession === void 0) continue;
		const list = byParent.get(row.parentSession);
		if (list === void 0) byParent.set(row.parentSession, [row]);
		else list.push(row);
	}
	const out = [];
	const seen = /* @__PURE__ */ new Set([id]);
	const queue = [...byParent.get(id) ?? []];
	while (queue.length > 0) {
		const next = queue.shift();
		if (next === void 0 || seen.has(next.id)) continue;
		seen.add(next.id);
		out.push(next);
		queue.push(...byParent.get(next.id) ?? []);
	}
	return out;
}
/** 会话配置端点的显式 contribution（sessionState/set/clear 三个 invocation）。
*
*  2026-09-02 修正（三处 wire 硬伤，全部是「client/host 两侧契约不对称」）：
*   1. namespace 必须是 'mbsfStatus'——host gateway 的 readBinding 逐字段
*      核对服务 binding（typertRemote.namespace），namespace 不同即抛
*      `binding-invalid`；一个服务只有一个 binding，无法挂第二个命名空间。
*   2. method 必须等于服务成员名——gateway 取 `implementation ?? method` 在
*      服务实例上找可调用成员，别名要靠 implementation 显式指回成员名。
*   3. 参数 codec 必须是 strict——client api 的 requireStrictDescriptor 对
*      result **与每个 parameter** 都要求 strict，src-json 参数会让
*      `ctx.remote.$mount` 直接抛 "has no strict codec"，插件整体加载失败。
*  result 与参数都用透传 schema（parse 原样返回），保留「不校验 wire 形状、
*  结构演进免同步」的宽松语义。
*/
const SESSION_CONFIG_INVOCATIONS = [
	{
		id: "mbsf-compaction#mbsfStatus/sessionState",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "sessionState",
		invocation: { kind: "direct" },
		parameters: [{
			name: "sessionId",
			wire: "sessionId",
			source: "json",
			codec: SESSION_ID_CODEC
		}],
		result: SESSION_CONFIG_RESULT_CODEC
	},
	{
		id: "mbsf-compaction#mbsfStatus/sessionSet",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "sessionSet",
		invocation: { kind: "direct" },
		parameters: [{
			name: "sessionId",
			wire: "sessionId",
			source: "json",
			codec: SESSION_ID_CODEC
		}, {
			name: "partial",
			wire: "partial",
			source: "json",
			codec: SESSION_OVERRIDE_CODEC
		}],
		result: SESSION_CONFIG_RESULT_CODEC
	},
	{
		id: "mbsf-compaction#mbsfStatus/restart",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "restart",
		invocation: { kind: "direct" },
		parameters: [{
			name: "sessionId",
			wire: "sessionId",
			source: "json",
			codec: SESSION_ID_CODEC
		}],
		result: RESTART_RESULT_CODEC
	},
	{
		id: "mbsf-compaction#mbsfStatus/reclaimMemory",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "reclaimMemory",
		invocation: { kind: "direct" },
		parameters: [],
		result: RECLAIM_RESULT_CODEC
	},
	{
		id: "mbsf-compaction#mbsfStatus/sessionClear",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "sessionClear",
		invocation: { kind: "direct" },
		parameters: [{
			name: "sessionId",
			wire: "sessionId",
			source: "json",
			codec: SESSION_ID_CODEC
		}],
		result: SESSION_CONFIG_RESULT_CODEC
	},
	{
		id: "mbsf-compaction#mbsfStatus/trimTargets",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "trimTargets",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "mbsf-compaction/types#MbsfTrimTargets",
			schema: { parse: (value) => value },
			create: passthroughSchemaFactory
		}
	},
	{
		id: "mbsf-compaction#mbsfStatus/setTrimTarget",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "setTrimTarget",
		invocation: { kind: "direct" },
		parameters: [{
			name: "input",
			wire: "input",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: "mbsf-compaction/types#MbsfTrimSetInput",
				schema: { parse: (value) => value },
				create: passthroughSchemaFactory
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "mbsf-compaction/types#MbsfTrimSetResult",
			schema: { parse: (value) => value },
			create: passthroughSchemaFactory
		}
	},
	{
		id: "mbsf-compaction#mbsfStatus/trimDelete",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "trimDelete",
		invocation: { kind: "direct" },
		parameters: [{
			name: "input",
			wire: "input",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: "mbsf-compaction/types#MbsfTrimDeleteInput",
				schema: { parse: (value) => value },
				create: passthroughSchemaFactory
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "mbsf-compaction/types#MbsfTrimDeleteResult",
			schema: { parse: (value) => value },
			create: passthroughSchemaFactory
		}
	},
	{
		id: "mbsf-compaction#mbsfStatus/trimDeleted",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "trimDeleted",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "mbsf-compaction/types#MbsfTrimDeletedResult",
			schema: { parse: (value) => value },
			create: passthroughSchemaFactory
		}
	},
	{
		id: "mbsf-compaction#mbsfStatus/trimRestore",
		service: "mbsfStatus",
		namespace: "mbsfStatus",
		method: "trimRestore",
		invocation: { kind: "direct" },
		parameters: [{
			name: "input",
			wire: "input",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: "mbsf-compaction/types#MbsfTrimRestoreInput",
				schema: { parse: (value) => value },
				create: passthroughSchemaFactory
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: "mbsf-compaction/types#MbsfTrimRestoreResult",
			schema: { parse: (value) => value },
			create: passthroughSchemaFactory
		}
	}
];
/** 本网关唯一的 Typert contribution。
*
*  **为什么必须合成一个**：`ctx.typert.register()` 以 `<package>#<face>`
*  为唯一键（`registry.validatePackage`：键已存在即抛
*  `package face "..." is already registered`）。同一个包的 host face
*  只能 `register` 一次——想再挂端点，必须把 invocations 合进同一个
*  contribution 数组，而不是再 register 一次。
*
*  2026-09-02 修正（四处 wire 硬伤，全部是「client/host 两侧契约不对称」）：
*   1. namespace 必须是 'mbsfStatus'——host gateway 的 readBinding 逐字段
*      核对服务 binding（typertRemote.namespace），namespace 不同即抛
*      `binding-invalid`；一个服务只有一个 binding，无法挂第二个命名空间。
*   2. method 必须等于服务成员名——gateway 取 `implementation ?? method` 在
*      服务实例上找可调用成员，别名要靠 implementation 显式指回成员名。
*   3. 参数 codec 必须是 strict——client api 的 requireStrictDescriptor 对
*      result **与每个 parameter** 都要求 strict，src-json 参数会让
*      `ctx.remote.$mount` 直接抛 "has no strict codec"，插件整体加载失败。
*   4. snapshot + 三个 session 端点合并在**一次** register 里（见上）。
*  result 与参数都用透传 schema（parse 原样返回），保留「不校验 wire 形状、
*  结构演进免同步」的宽松语义。 */
const STATUS_CONTRIBUTION = {
	package: "mbsf-compaction",
	face: "host",
	schemas: [],
	invocations: [...SNAPSHOT_INVOCATIONS, ...SESSION_CONFIG_INVOCATIONS],
	model: {
		services: [],
		events: [],
		objects: []
	}
};
/** 未必记忆的**可配置字段表**——单一来源：0.1.5 的 `settings.register` 与
*  0.1.7 的 `static Config` 都从这里取字段，两版不可能漂移。
*
*  默认值 = `getRuntimeConfig()` 的当前值（不是写死常量）：0.1.7 的 base 层
*  就是 schema default，「重置字段」= unset user 层回到 base——回到的必须是
*  **用户 config.json 里的值**，否则重置反而会把用户的设置改掉。 */
function configFieldDefaults() {
	const current = getRuntimeConfig();
	return {
		injectEnabled: current.injectEnabled,
		dateAnchorEnabled: current.dateAnchorEnabled,
		autoCompact: current.autoCompact,
		restartCleanupEnabled: current.restartCleanupEnabled,
		cleanupPruneTurns: current.cleanupPruneTurns,
		backupKeepCount: current.backupKeepCount,
		restartButtonVisible: current.restartButtonVisible,
		activityIndicatorEnabled: current.activityIndicatorEnabled,
		activityLabelEnabled: current.activityLabelEnabled,
		sessionStreamKeepCount: current.sessionStreamKeepCount,
		dshHeapMb: current.dshHeapMb,
		autoReclaimEnabled: current.autoReclaimEnabled,
		autoReclaimThresholdPct: current.autoReclaimThresholdPct
	};
}
/** 构造配置 schema——**两版共用的唯一字段定义**（0.1.5 的 register 与 0.1.7
*  的 `static Config` 都调它，字段不可能漂移）。
*
*  @param markVolatile - true 时给每个字段标 `volatile()`（0.1.7 的配置表单
*    准入条件）；0.1.5 的 schemastery 没有这个方法，传 false。
*  @param withDefaults - true 时把当前生效值写成 schema default（0.1.7 的
*    base 层靠它；「重置字段」= unset user 层回到这个值）。0.1.5 走
*    `register(..., { base })` 显式传 base，不需要 default。
*/
function configSchema(markVolatile, withDefaults) {
	const d = configFieldDefaults();
	/** 给一个字段按需加 default / volatile。
	*
	*  ⚠️ 这里必须走**结构化 cast**而不是直接 `.volatile()`：本引擎编译时解析的
	*  `schemastery` 是 0.1.5 那份（`node_modules` 链接到 `.runtime/dsh-0.1.5-rc.2`），
	*  它的类型里**没有** `volatile`——直接调用会 TS2339。而运行时两版都可能
	*  加载（app 用 0.1.7 的 schemastery），所以只能在运行时探测 + 断言。 */
	const mark = (field, value) => {
		let next = field;
		if (withDefaults) next = next.default(value);
		if (markVolatile) next = next.volatile();
		return next;
	};
	return z.object({
		/** 记忆浮现（注入）开关。 */
		injectEnabled: mark(z.boolean(), d.injectEnabled),
		/** 日期锚点注入开关。 */
		dateAnchorEnabled: mark(z.boolean(), d.dateAnchorEnabled),
		/** γ 自动压缩开关。 */
		autoCompact: mark(z.boolean(), d.autoCompact),
		/** 重启时清理（破坏性，默认关）——唯一清理触发点。 */
		restartCleanupEnabled: mark(z.boolean(), d.restartCleanupEnabled),
		/** 剪裁深度：0 = 不剪裁（只剥离）；≥3 = 至少保留最近 N 轮。 */
		cleanupPruneTurns: mark(z.number().step(1).min(0), d.cleanupPruneTurns),
		/** 每会话备份保留份数（0 = 不设上限）。 */
		backupKeepCount: mark(z.number().step(1).min(0), d.backupKeepCount),
		/** 「重启 DSH」按钮是否显示。 */
		restartButtonVisible: mark(z.boolean(), d.restartButtonVisible),
		/** 🐾 活动指示器开关（默认开——2026-10-14）。 */
		activityIndicatorEnabled: mark(z.boolean(), d.activityIndicatorEnabled),
		/** 🐾 活动文字开关（默认开——与动画独立，2026-10-14）。 */
		activityLabelEnabled: mark(z.boolean(), d.activityLabelEnabled),
		/** 剥离时保留最近 N 条 stream（0 = 全剥）。 */
		sessionStreamKeepCount: mark(z.number().step(1).min(0), d.sessionStreamKeepCount),
		/** DSH 堆上限（MB）：0 = 不注入（node 默认）；≥4096 = 注入
		*  --max-old-space-size（下次重启 dsh 生效——堆上限只能启动前定）。 */
		dshHeapMb: mark(z.number().step(1).min(0), d.dshHeapMb),
		/** 缓存自动释放开关（默认关）。 */
		autoReclaimEnabled: mark(z.boolean(), d.autoReclaimEnabled),
		/** 自动释放阈值（% 真实堆上限；20–95）。 */
		autoReclaimThresholdPct: mark(z.number().step(1).min(AUTO_RECLAIM_PCT_MIN).max(AUTO_RECLAIM_PCT_MAX), d.autoReclaimThresholdPct),
		/** 压缩 tail 近因窗口（条，8–256；默认 64）——`structuralTailStart` 的
		*  近因兜底上限。N 越大越容易让「闭合边界」被采用；N ≥ 当前消息数时
		*  该会话不压缩（UI 需提示）。工程值，无明确依据。 */
		compactTailMessages: mark(z.number().step(1).min(COMPACT_TAIL_MESSAGES_MIN).max(COMPACT_TAIL_MESSAGES_MAX), d.compactTailMessages)
	});
}
/** 0.1.7 用的 volatile 配置 schema（0.1.5 下返回 undefined）。
*
*  **探测式**：`schemastery@0.1.5` 没有 `volatile()`（实测
*  `typeof z.boolean().volatile === 'undefined'`），而 volatile 正是 0.1.7
*  配置表单的准入条件——`SettingsForms.describe()` 的 `volatileForm(schema)`
*  只保留 `meta.volatile` 的字段，非 volatile 的普通配置**不会**出现在表单里
*  （有意的：普通字段改动要重启，不能当热配置编辑）。所以：
*    · 有 volatile → 返回 schema，条目成为可配置 namespace（0.1.7 生效）；
*    · 没有 volatile → 返回 undefined，条目照常挂载（0.1.5 走 register 老路）。
*  绝不 throw——本引擎被 0.1.5 与 0.1.7 两版共享，构造期抛错会让整个
*  `mbsf-status` 条目未激活（状态页一起挂）。
*
*  volatile 的约束（schemastery 会校验）：只能落在**固定对象路径**的叶子上，
*  不能嵌套在另一个 volatile 之下——本表是一层平铺，天然满足。 */
function buildConfigSchema() {
	if (typeof z.boolean().volatile !== "function") return void 0;
	return configSchema(true, true);
}
/** 读引擎加载标记（2026-11-09）：引擎在 preset 域、网关在宿主域，ctx 隔离，
*  只能靠文件判断。同 pid 才算「本进程加载过」；旧进程留下的标记不算。 */
function readEngineStatus() {
	try {
		const raw = readFileSync(join(homedir(), ".mbsf", "engine-status.json"), "utf8");
		const j = JSON.parse(raw);
		const loaded = j.pid === process.pid;
		return {
			loaded,
			pid: j.pid ?? null,
			startedAt: j.startedAt ?? null,
			note: loaded ? null : "引擎标记来自旧进程（重启前）——本进程尚未加载引擎。若重启后仍如此，通常是 DSH 大版本升级导致内置 standard preset 的结构变化，本包的覆盖内容需要跟随更新（重装或升级本包）"
		};
	} catch {
		return {
			loaded: false,
			pid: null,
			startedAt: null,
			note: "未找到引擎加载标记——本进程压缩引擎未加载（preset 覆盖未生效，压缩不会发生）"
		};
	}
}
/** 未必记忆状态网关：注册 cordis 服务 `mbsfStatus` + Typert Remote `snapshot`，
*  并注册未必记忆配置 namespace（旧名 electronic-sheep——2026-09-03 改 MBSF）
*  （UI 配置面板 → settings 文档 → watch → runtime-config 落盘 + 内存单例，
*  压缩/注入侧逐次读取实时生效）。 */
var MbsfStatusGateway = class extends Service {
	static inject = ["settings", "typert"];
	/** 0.1.7 的配置表单 schema（`settings.describe()` 经此把**宿主层**的
	*  `mbsf-status` 条目暴露成一个可配置 namespace）。0.1.5 下不生效也不报错
	*  ——`schemastery@0.1.5` 没有 `volatile()`，所以构造是探测式的（见
	*  {@link buildConfigSchema}）。
	*
	*  ── 为什么需要它（2026-09-27 小爪修「配置卡打开没效果」）──────────────
	*  0.1.7 的配置表单**只**来自 `entry.fiber.runtime.Config`（dsh-settings
	*  `schema(entry)`：`entry.fiber?.runtime?.Config`，且要求是 schemastery
	*  schema——判据 `"toJSON" in schema`）。而卡片原来去找的
	*  `configForms.get('mbsf')` / `get('compaction-mbsf')` 两处都不成立：
	*    · `compaction-mbsf` 在 **preset 域**内，而 `settings.describe()` 只遍历
	*      `configEditor.configuration()`（profile 树的条目）⟹ 实测 18 个
	*      namespace 里没有任何 mbsf/compaction 条目，`get()` 拿到的 form
	*      永远 status='unavailable'；
	*    · 就算它可见，其 Config 也继承自 `BasicCompactionEngine`（压缩参数
	*      thresholdRatio/retainRatio/…），与卡片期望的 injectEnabled/
	*      autoCompact/… 字段对不上。
	*
	*  修法 = 让**宿主层**的 `mbsf-status` 条目（它确实在 profile 树里）携带
	*  这份 volatile schema。volatile 的语义正好对上卡片契约：写入经
	*  `configEditor.edit()` 落进 profile 的 `cordis.patch.yml` 且**不重启**，
	*  由 loader 的 `_commitVolatile()` 把新值推进运行中的引用
	*  （`loader/volatile-update`）。字段值的最终事实源仍是
	*  `~/.mbsf/config.json`（下面的 watch 回调调 `setRuntimeConfig`），
	*  与 0.1.5 完全同一份，两版不会漂移。
	*
	*  默认值取 `getRuntimeConfig()`（当前生效值）而非写死常量：0.1.7 的 base
	*  层就是 schema default，卡片「重置」= unset user 层回到 base——回到的
	*  应当是**用户 config.json 里的值**，否则重置会把用户的设置改掉。 */
	static Config = buildConfigSchema();
	/** Gateway 消费的 typertRemote binding（validateBinding 逐字段核对；
	*  与 dsh-typert-protocol 的 bindTypertRemote 输出同构）。 */
	typertRemote;
	/** ctx.typert.register 的 disposer（dispose 时撤销端点注册）。
	*  只有一个——`<package>#<face>` 是 registry 唯一键，本包 host face
	*  全局只能注册一次，四类端点必须合并进同一 contribution。 */
	_typertDisposer;
	/** 0.1.7 传入的配置（volatile 字段是引用，loader 就地更新）。 */
	liveConfig;
	constructor(ctx, config) {
		super(ctx, "mbsfStatus");
		this.liveConfig = config;
		this.typertRemote = Object.freeze({
			service: this,
			serviceKey: "mbsfStatus",
			namespace: "mbsfStatus"
		});
		const settings = ctx.settings;
		if (typeof settings.register === "function") try {
			settings.register("mbsf", configSchema(false, false), {
				applies: "live",
				base: getRuntimeConfig()
			}).watch((next) => {
				setRuntimeConfig(next);
			});
		} catch {}
		if (config !== void 0) ctx.on("loader/volatile-update", ((paths) => {
			this.syncLiveConfig(paths);
		}));
		this._typertDisposer = ctx.typert.register(STATUS_CONTRIBUTION);
	}
	/** 把 0.1.7 volatile 引用里的当前值同步进引擎 runtime-config。
	*
	*  @param paths - loader `loader/volatile-update` 事件报告的变更路径
	*    （`[['autoReclaimEnabled'], ['dshHeapMb']]`）。**只有出现在这里的字段
	*    才被同步**——这是防「默认值覆盖用户设置」的关键（见构造函数的说明）。
	*    省略/形状不认识 → **不同步任何字段**（宁可漏同步也不能误写）。
	*
	*  幂等且廉价：只比较报告到的几个标量，值相同则不写盘。 */
	syncLiveConfig(paths) {
		const live = this.liveConfig;
		if (live === null || typeof live !== "object") return;
		const touched = /* @__PURE__ */ new Set();
		if (Array.isArray(paths)) {
			for (const p of paths) if (Array.isArray(p) && typeof p[0] === "string") touched.add(p[0]);
			else if (typeof p === "string") touched.add(p);
		}
		if (touched.size === 0) return;
		const partial = {};
		for (const field of touched) {
			const value = live[field];
			if (value === void 0) continue;
			const resolved = value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value;
			if (typeof resolved === "boolean" || typeof resolved === "number" && Number.isFinite(resolved)) partial[field] = resolved;
		}
		if (Object.keys(partial).length === 0) return;
		const current = getRuntimeConfig();
		const changed = {};
		for (const [field, value] of Object.entries(partial)) if (current[field] !== value) changed[field] = value;
		if (Object.keys(changed).length === 0) return;
		try {
			setRuntimeConfig(changed);
		} catch {}
	}
	/** 插件生命周期：撤销 Typert 端点注册（幂等；settings 的 scope 由 ctx 自动清理）。 */
	async dispose() {
		await this._typertDisposer?.();
		this._typertDisposer = void 0;
	}
	/** 汇总全部未必记忆运行状态。 */
	snapshot() {
		const heapStats = getHeapStatistics();
		const limitMb = Math.round(heapStats.heap_size_limit / 1048576);
		const usedMb = Math.round(heapStats.used_heap_size / 1048576);
		return {
			version: readVersion(),
			brain: mbsfStats(),
			lastSummarize: lastSummarizeStats(),
			compression: latencyStats(),
			compressionHistory: foldHistory(resolveMbsfDataDir(), 30),
			lastCleanup: readCleanupStats() ?? null,
			backups: {
				prune: backupDirStats(pruneBackupDirPath()),
				strip: backupDirStats(stripBackupDirPath())
			},
			heap: {
				limitMb,
				usedMb,
				usedRatio: limitMb > 0 ? usedMb / limitMb : 0,
				maxMb: resolveDshHeapMaxMb(),
				configuredMb: getRuntimeConfig().dshHeapMb,
				idle: idleSnapshot()
			},
			catalog: catalogProbeReport(),
			verifier: verifierProbeReport(),
			engine: readEngineStatus()
		};
	}
	/** 会话配置状态（含继承链来源：自身覆盖 → 父链 → 全局）。 */
	sessionState(sessionId) {
		return sessionConfigStateFor({ sessionId });
	}
	/** 写入（合并）会话覆盖，返回新状态。 */
	sessionSet(sessionId, partial) {
		setSessionOverride(sessionId, partial ?? {});
		return sessionConfigStateFor({ sessionId });
	}
	/** 清除会话覆盖（恢复继承/全局），返回新状态。 */
	sessionClear(sessionId) {
		clearSessionOverride(sessionId);
		return sessionConfigStateFor({ sessionId });
	}
	/**
	* 面板「重启 DSH」按钮：派发一次只重启不裁剪的重启（2026-09-10）。
	*
	* **运行中保护（2026-09-10 事故后加）**：任何会话 `status === 'running'`
	* 时拒绝重启——重启会打断在跑的回合，而客户端可能因此卡在「运行中」假
	* 状态（9ffe1d63 实测：重启后该会话每次发送都被 cancel，
	* `turn/end reason={kind:"user"}`，UI 永远「Deep diving…」）。
	*/
	restart(sessionId) {
		try {
			const running = (this.ctx.get("agents")?.list?.() ?? []).filter((agent) => agent.status === "running");
			if (running.length > 0) return {
				ok: false,
				detail: `有 ${running.length} 个会话正在运行（${running.map((a) => a.id.slice(0, 18)).join("、")}）——重启会打断它们的回合并可能让客户端卡住，请等它们空闲后再试`
			};
		} catch {}
		const request = maybeScheduleRestart({ sessionId });
		if (request === void 0) return {
			ok: false,
			detail: "已有挂起的重启/重置请求，或请求写入失败"
		};
		return {
			ok: true,
			detail: `已派发重启（source=settings-button，at=${request.at}）`
		};
	}
	/**
	* 立即省内存（2026-11-09 公开版）：清派生缓存（可重算的预检/锚定 Map）+ 强制 GC。
	*
	* 与内部版的区别：公开版没有记忆索引（memory-index），可清的只有压缩侧的
	* 派生缓存。清理后下次预检/锚定重新计算（多花几 ms），内存立刻下降。
	* 不删任何持久数据。
	*/
	async reclaimMemory() {
		try {
			if (!isIdle()) {
				const snap = idleSnapshot();
				return {
					ok: false,
					reclaimed: 0,
					before: 0,
					after: 0,
					gcMs: 0,
					clearedEntries: {},
					detail: `当前不空闲（在途 mbsf 调用 ${snap.inflight}，阶段「${snap.phase}」）——释放会与在途调用抢事件循环，请等空闲后再试`
				};
			}
		} catch {}
		try {
			const before = getHeapStatistics().used_heap_size;
			const clearedEntries = clearDerivedCaches();
			const gcStart = Date.now();
			const gc = globalThis.gc;
			if (typeof gc === "function") gc();
			const gcMs = Date.now() - gcStart;
			const after = getHeapStatistics().used_heap_size;
			const reclaimed = Math.max(0, before - after);
			return {
				ok: true,
				reclaimed,
				before,
				after,
				gcMs,
				clearedEntries,
				detail: `已清理派生缓存（预检 ${clearedEntries.preflight ?? 0} 条 / 锚定 ${clearedEntries.anchorTurn ?? 0} 条），回收约 ${Math.round(reclaimed / 1048576)} MB`
			};
		} catch (e) {
			return {
				ok: false,
				reclaimed: 0,
				before: 0,
				after: 0,
				gcMs: 0,
				clearedEntries: {},
				detail: `释放失败：${e.message}`
			};
		}
	}
	/**
	* 会话历史剪裁清单（设置页）：可剪裁会话 + 勾选状态 + 上次剪裁记录。
	*
	* **只读**（不写 trim-targets.json）；每行的大小/时间来自 stat，工作区路径
	* 来自会话头第一帧（不解整份日志——大文件几百 MB）。
	*/
	trimTargets() {
		const dshHome = dshHomePath();
		const archivedIds = this.archivedSessionIds(dshHome);
		const liveIds = this.liveSessionIds();
		const rows = listTrimCandidates(dshHome, 500, archivedIds);
		const stats = readCleanupStats();
		const lastById = /* @__PURE__ */ new Map();
		for (const row of stats?.trim?.sessions ?? []) lastById.set(row.id, {
			at: stats?.at ?? "",
			stripFiles: row.stripFiles,
			pruneFiles: row.pruneFiles,
			freedBytes: row.freedBytes
		});
		let selectedCount = 0;
		let selectedBytes = 0;
		return {
			rows: rows.map((row) => {
				if (row.selected) {
					selectedCount += 1;
					selectedBytes += row.bytes;
				}
				return toTrimRow(row, lastById.get(row.id) ?? null, liveIds.has(row.id));
			}),
			selectedCount,
			selectedBytes,
			trimEnabled: getRuntimeConfig().restartCleanupEnabled
		};
	}
	/** 勾选/取消一个会话（下一次重启生效；全局开关开着时勾选不生效）。 */
	setTrimTarget(input) {
		const id = typeof input?.sessionId === "string" ? input.sessionId : "";
		if (id === "") throw new Error("setTrimTarget: sessionId is required");
		return {
			id,
			selected: setTrimTarget(id, input.selected === true).selected
		};
	}
	/**
	* 归档集合：优先问宿主注册表（内存态、即时），拿不到再读状态文件。
	*
	* 两个来源都给同一份信息；注册表是权威，文件是兜底。任何异常都退化成
	* 「空集合」而不是抛——归档状态读不到，不该让整个清单打不开。
	*/
	archivedSessionIds(dshHome) {
		try {
			const list = this.ctx.get("workspaceRegistry")?.archivedSessionIds;
			if (Array.isArray(list)) return new Set(list.map((id) => String(id)));
		} catch {}
		return readArchivedSessionIds(dshHome);
	}
	/** 内存里活着的会话（正在跑 / 正开着）——删除前必须避开它们。 */
	liveSessionIds() {
		try {
			const list = this.ctx.get("sessions")?.list?.() ?? [];
			return new Set(list.map((session) => String(session?.id ?? "")));
		} catch {
			return /* @__PURE__ */ new Set();
		}
	}
	/**
	* 删除一个会话（搬到回收站，30 天内可恢复）。
	*
	* **服务端重新判定**，不信客户端说的「可删」：清单是快照，用户在确认框前
	* 可能已经跑起了这个会话、或刚把它取消归档。判定口径只有 `trimDeletable`
	* 一处，这里再走一遍。
	*
	* 父会话删除会**连同名下子代理会话一起搬走**（不留孤儿目录）。
	*/
	trimDelete(input) {
		const id = typeof input?.sessionId === "string" ? input.sessionId.trim() : "";
		if (id === "") return {
			ok: false,
			deleted: [],
			bytes: 0,
			detail: "缺少会话 id"
		};
		const dshHome = dshHomePath();
		const rows = listTrimCandidates(dshHome, 1e3, this.archivedSessionIds(dshHome));
		const row = rows.find((candidate) => candidate.id === id);
		if (row === void 0) return {
			ok: false,
			deleted: [],
			bytes: 0,
			detail: "清单里没有这个会话（可能刚被删掉或目录在变），请刷新后再试"
		};
		const liveIds = this.liveSessionIds();
		const door = trimDeletable(row, liveIds.has(id));
		if (!door.deletable) return {
			ok: false,
			deleted: [],
			bytes: 0,
			detail: door.reason === "live" ? "这个会话正在运行，先停掉它再删" : door.reason === "parent" ? "它的主会话还没归档——先把主会话归档（归档不会带上子代理），再回来删" : "活跃会话不能删——请先在 DSH 会话列表里把它归档，再回来删除"
		};
		const children = descendantsOf(rows, id);
		const liveChild = children.find((child) => liveIds.has(child.id));
		if (liveChild !== void 0) return {
			ok: false,
			deleted: [],
			bytes: 0,
			detail: `它的子代理会话 ${liveChild.id} 正在运行，等它结束再删`
		};
		const items = [{
			id: row.id,
			sessionDir: row.sessionDir,
			workspaceDir: row.workspace,
			workspacePath: row.workspacePath,
			role: "root",
			siblings: children.map((child) => child.id),
			...row.title === void 0 ? {} : { title: row.title },
			...row.origin === void 0 ? {} : { origin: row.origin }
		}, ...children.map((child) => ({
			id: child.id,
			sessionDir: child.sessionDir,
			workspaceDir: child.workspace,
			workspacePath: child.workspacePath,
			role: "child",
			siblings: [row.id],
			...child.title === void 0 ? {} : { title: child.title },
			...child.origin === void 0 ? {} : { origin: child.origin },
			...child.parentSession === void 0 ? {} : { parentSession: child.parentSession }
		}))];
		try {
			const outcome = deleteSessions(dshHome, items);
			removeTrimTargets(outcome.ids);
			return {
				ok: true,
				deleted: outcome.ids,
				bytes: outcome.bytes
			};
		} catch (error) {
			return {
				ok: false,
				deleted: [],
				bytes: 0,
				detail: error instanceof Error ? error.message : String(error)
			};
		}
	}
	/** 回收站列表（只读；顺手清理超过 30 天的备份）。 */
	trimDeleted() {
		const { entries, purged } = listDeleted();
		return {
			purged,
			entries: entries.map((entry) => ({
				id: entry.id,
				...entry.title === void 0 ? {} : { title: entry.title },
				workspacePath: entry.workspacePath,
				...entry.origin === void 0 ? {} : { origin: entry.origin },
				...entry.parentSession === void 0 ? {} : { parentSession: entry.parentSession },
				bytes: entry.bytes,
				deletedAt: entry.deletedAt,
				expiresAt: entry.expiresAt,
				remainingDays: entry.remainingDays,
				role: entry.role,
				siblingCount: entry.siblings.length
			}))
		};
	}
	/** 从回收站恢复（父会话整批恢复；原位置已有同名会话时拒绝，不覆盖）。 */
	trimRestore(input) {
		const id = typeof input?.sessionId === "string" ? input.sessionId.trim() : "";
		if (id === "") return {
			ok: false,
			restored: [],
			detail: "缺少会话 id"
		};
		try {
			const { restored } = restoreDeleted(dshHomePath(), id);
			return {
				ok: true,
				restored
			};
		} catch (error) {
			return {
				ok: false,
				restored: [],
				detail: error instanceof Error ? error.message : String(error)
			};
		}
	}
};
//#endregion
export { MbsfStatusGateway, MbsfStatusGateway as default, descendantsOf, toTrimRow, trimDeletable };
