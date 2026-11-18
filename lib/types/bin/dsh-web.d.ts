#!/usr/bin/env node
/**
 * mbsf-dsh —— 未必记忆 DSH 引擎启动器（堆保障）
 *
 * 用户机器上的 DSH（@deepseek-ai/dsh 发行版）bin 不设堆上限：V8 默认
 * old-space cap 约 4GiB（本机实测 4.2GiB），`dsh web` 加载会话归档 + 脑索引
 * 时峰值可达数 GB → OOM abort 崩溃史（2026-08-31 三次 .ips 均
 * FatalProcessOutOfMemory）。Node 的堆上限必须在进程启动前定
 * （v8.setFlagsFromString 对 --max-old-space-size 无效），所以本启动器在
 * spawn DSH 之前注入 NODE_OPTIONS。
 *
 * 用法:
 *   mbsf-dsh web            # ≡ dsh web，但自带堆保障
 *   mbsf-dsh <任意 dsh 参数>
 *
 * 行为:
 *   - NODE_OPTIONS 已有 --max-old-space-size → 直通（尊重显式配置，不覆盖）
 *   - 无 → 注入 ESHEEP_DSH_HEAP_MB（默认 8192）
 *   - DSH_BIN 可显式指定 DSH bin（绝对路径或 PATH 名，默认 `dsh`）
 *   - 退出码/信号透传
 *
 * @module mbsf-compaction/bin/dsh-web
 */
import { spawn } from 'node:child_process';
export declare const DEFAULT_HEAP_MB = 8192;
/**
 * 计算注入后的 NODE_OPTIONS。已有 --max-old-space-size 显式配置 → 原样直通；
 * 否则追加（或新建）`--max-old-space-size=<heapMb>`。
 */
export declare function computeNodeOptions(cur: string | undefined, heapMb: string): string;
/** spawn 参数（可测）。 */
export declare function resolveSpawn(dshBin: string | undefined, args: string[], heapMb: string): {
    bin: string;
    args: string[];
    env: {
        NODE_OPTIONS: string;
    };
};
/** 主入口：spawn DSH，透传 stdio 与退出码。返回子进程（可测）。 */
export declare function main(argv: string[]): ReturnType<typeof spawn>;
