/**
 * 会话日志健康自愈（session-health）——补 step 配对缺口
 *
 * 背景：会话日志是纯追加的，理论上 event 流里每个 assistant/message 与
 * step/end 都必须有匹配的 step/start（DSH token meter 的严格不变量）。
 * 但 OpenClaw→DSH 的迁移种子可能从某个 step 的 chunks 中途开始（缺少该
 * step 的 step/start），或历史上异常写入留下配对缺口——这类日志在
 * `/compact`（token meter 校验）时会直接报错，压缩功能瘫痪。
 *
 * 本模块在**事件级**扫描：解包打包行（reasoning-chunks 等）后按 token
 * meter 规则逐事件核对 step 配对，发现缺口就**原地补插** step/start
 * （必要时先补插 step/end 闭合上一个未结束 step），seq 重编号为 0 起
 * 连续，引用（sourceEventSeqs / shadowedSeqs / shadowedRange）经 seqMap
 * 精确重映射（映射不到的坏引用删除——顺带清理历史污染帧），然后
 * encodeCurrentEvent 逐事件产 v3 行 + 多帧 zstd 写回（与 DSH 写侧一致）。
 *
 * 安全设计（与 session-prune 对齐）：
 *  - 修复前 foldSurface + step 配对重扫双重验证，不通过则不动原文件；
 *  - 备份原日志（默认开）到 `health-backups/`（脑数据目录内，不参与再扫描）；
 *  - 临时文件 + fsync + 原子 rename（POSIX），绝不写坏原文件；
 *  - 扫描层 mtime 防线：只处理 mtime 早于 minAgeMs 的日志（排除活跃会话）。
 *
 * @module mbsf-compaction/session-health
 */
import { type PruneEvent } from './session-prune.ts';
export { detectStepViolations } from './session-prune.ts';
/** 一次健康检查发现的缺口。 */
export interface HealthIssue {
    kind: 'missing-step-start' | 'seq-gap' | 'surface-fail';
    /** 出问题的原始 seq（重编号前）。 */
    seq?: number;
    detail: string;
}
/** 事件级解包：header + 全部事件（seq 0 起连续校验）。解码失败返回 null。 */
export declare function decodeEventsFull(buffer: Buffer, zstd: boolean): {
    header: Record<string, unknown>;
    events: PruneEvent[];
} | null;
/** token meter 规则的 step 配对检测：返回违规事件 seq 列表。
 *  （实现见 session-prune.ts——B' 裁剪与健康检查共用。） */
/**
 * 补插缺失的 step/start（必要时先 step/end 闭合旧 step），seq 重编号为
 * 0 起连续。返回修复后事件与插入数。
 */
export declare function repairStepStarts(events: readonly PruneEvent[]): {
    events: PruneEvent[];
    inserted: number;
};
/**
 * 事件数组 → DSH 写侧兼容字节：0.1.5 v3 逐事件编码（encodeCurrentEvent）+
 * 多帧 zstd（header 一帧 + body 一帧，带 content-checksum）。
 */
export declare function encodeEventsLog(header: Record<string, unknown>, events: readonly PruneEvent[], zstd: boolean): Buffer;
export interface HealthSessionOptions {
    /** 是否跳过 mtime 早于此年龄（毫秒）的日志（0 = 不设防线）。 */
    minAgeMs?: number;
    /** 修复前是否备份原日志（默认 true）。 */
    backup?: boolean;
    /** 备份目录（默认 `<脑数据目录>/health-backups/`）。 */
    backupDir?: string;
    /** 解码/修复失败时是否吞掉异常（默认 true——健康检查是增强，不阻断启动）。 */
    quiet?: boolean;
}
export interface HealthSessionResult {
    /** 会话日志绝对路径。 */
    path: string;
    /** 检测到的违规事件数（修复前）。 */
    violations: number;
    /** 是否执行了修复写盘。 */
    repaired: boolean;
    /** 修复插入的 step/start 数。 */
    inserted?: number;
    /** 是否修复了 zstd 分帧违规（单帧 → 首帧=header 行 + 正文帧）。
     *  宿主读侧严格断言首帧；没有本地容错补丁的用户靠这里自愈。 */
    framingRepaired?: boolean;
    /** 修复前物理字节数。 */
    beforeBytes?: number;
    /** 修复后物理字节数。 */
    afterBytes?: number;
    /** 失败原因（repaired=false 且不是健康时）。 */
    error?: string;
}
/** 对单个会话日志做健康检查；发现违规则修复写盘。返回结果或 undefined（健康/不可读）。 */
/**
 * zstd 容器分帧不变量校验（2026-09-27 事故后加——§6.10）。
 *
 * **DSH 容器不变量：首帧恰好一行（header），次帧 = 正文。** DSH 读侧据此校验，
 * 违反时报 `corrupt Zstandard session log: first frame is not exactly one
 * header line`，整个会话打不开。
 *
 * **为什么需要这个函数**：`encodeSessionLog` 本身是对的（`Buffer.concat` 两个
 * 帧），但「绕过它手搓 `zstdCompressSync` 整文件压一帧」的错误它挡不住——
 * 2026-09-27 一次批量改写脚本正是如此，把 27 个会话压成单帧全部打不开。
 * 逻辑内容当时完全正确（decode 正常），坏的只有物理分帧。
 *
 * 明文（非 zstd）无分帧概念，恒返回 true。
 *
 * @param buffer - 会话日志原始字节。
 * @param zstd - 是否为 zstd 容器。
 * @returns 合规 `{ ok: true }`；违规 `{ ok: false, reason }`。
 */
export declare function checkZstdFraming(buffer: Buffer, zstd: boolean): {
    ok: boolean;
    reason?: string;
};
export declare function repairSessionFile(path: string, options?: HealthSessionOptions): HealthSessionResult | undefined;
export interface HealthScanOptions extends HealthSessionOptions {
    /** 日志小于它不处理（0 = 全处理）。 */
    thresholdBytes?: number;
}
export interface HealthScanResult {
    /** 修复写盘的会话日志。 */
    repaired: HealthSessionResult[];
    /** 因 mtime 防线/过小而跳过的日志数。 */
    skipped: number;
}
/** 扫描 dshHome/sessions 下全部会话日志，检测并修复 step 配对缺口。 */
export declare function scanAndRepairSessions(dshHome: string, options?: HealthScanOptions): Promise<HealthScanResult>;
