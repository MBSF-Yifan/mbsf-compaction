#!/usr/bin/env node
/**
 * 未必记忆 enable 命令 — 把某个 agent preset 的 compaction 后端切换到未必记忆
 *
 * 引擎本身零配置；在 DSH 里「启用」只差一处装配：preset 的 compaction
 * group 里把 `compaction-basic` 替换为 `compaction-mbsf`。
 * 本命令把这一行替换自动化（备份 + 幂等 + dry-run），不触碰 preset 的
 * 任何其他段 —— Agent 配置不进插件，插件只提供引擎与这条装配工具。
 *
 * 用法:
 *   mbsf-compaction enable [preset-id] [--dry-run] [--home <dir>]
 *
 * preset-id 缺省时：用户根下只有一个 preset 则默认它，多个则列出并报错。
 *
 * @module mbsf-compaction/bin/enable
 */
/** 用户 preset 根（与 dsh-agent-presets 的 USER_PRESET_DIR 一致）。 */
export declare const USER_PRESET_DIR = ".agent-presets";
export declare const BACKUP_SUFFIX = ".bak-mbsf";
export interface ApplyResult {
    /** 原文里是否命中 compaction-basic 装配。 */
    matched: boolean;
    /** 是否已装配未必记忆（幂等命中）。 */
    alreadyEnabled: boolean;
    /** 替换后的文本（未命中时为原文）。 */
    text: string;
}
/**
 * 纯文本替换：把 compaction-basic 装配行换成未必记忆装配行。
 * 不引入 config —— thresholdRatio/retainRatio/auto 均有包内默认值，
 * 需要覆写时用户在 preset 里自行加 config（与显式声明等价）。
 */
export declare function applyEnable(text: string): ApplyResult;
export interface EnableOptions {
    /** DSH home（缺省 `$DSH_HOME`，再缺省 `~/.dsh`）。 */
    home?: string;
    /** 只打印将做的替换，不写文件。 */
    dryRun?: boolean;
}
export type EnableStatus = 'enabled' | 'already-enabled' | 'no-compaction-group' | 'no-preset';
export interface EnableOutcome {
    status: EnableStatus;
    preset: string;
    file?: string;
    backupPath?: string;
    lines?: [string, string];
    message: string;
}
/** DSH home 解析：$DSH_HOME 优先，缺省 ~/.dsh（与 dsh-home-paths 同序）。 */
export declare function dshHome(home?: string): string;
/**
 * 列出用户根下的 preset id（仅目录，忽略非 preset-id 命名）。
 * @returns 按 id 排序的目录名；根不存在时返回空数组。
 */
export declare function listUserPresets(home?: string): Promise<string[]>;
/**
 * 对指定 preset 执行启用。preset-id 缺省时：用户根下唯一 preset 自动默认，
 * 多个则报 no-preset 并在 message 里列出可用 id。
 */
export declare function enablePreset(id: string | undefined, options?: EnableOptions): Promise<EnableOutcome>;
/** CLI 入口。返回进程退出码：0 = 成功/已启用/dry-run；1 = 找不到 preset、非法 id、无 compaction group。 */
export declare function main(argv: readonly string[]): Promise<number>;
