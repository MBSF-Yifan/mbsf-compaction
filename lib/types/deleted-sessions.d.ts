/**
 * 会话删除 + 30 天回收站（2026-11-07 一帆定）
 *
 * **语义**：删除 = 把会话目录**搬**到 `~/.mbsf/deleted-sessions/<id>/`，不是销毁。
 * 30 天内可从设置页「已删除」列表恢复；到期后打开该列表时自动永久清理
 * （清理**只**发生在这一处，没有隐藏的后台删除线程）。
 *
 * ## 为什么是搬目录而不是删文件
 *
 * DSH 的会话是**扫盘发现**的（`listProjectDirs` / `listSessionDirs` +
 * 「元数据缺失的行直接跳过」），所以把目录移走，DSH 就看不见它了——**不需要写
 * `workspace.json`**。这很重要：那个文件是宿主内存态的持久化影子，插件去改它
 * 会和宿主抢写（宿主下次写整表就把我们的改动覆盖掉，还可能留下脏状态）。
 * 删除走「搬目录」这条路，对 DSH 是零侵入、可回滚的。
 *
 * ## 为什么主会话删除要连子代理一起搬
 *
 * 子代理会话的头里有 `parentSession`。只搬走父会话，子代理目录会变成**孤儿**
 * （侧栏本来就不显示子代理，没人会发现，但它会一直占着盘、一直出现在清单里）。
 * 所以一次删除 = 一个 **batch**：父会话 + 名下子代理，共用 `batchId`；恢复父会话
 * 时整批回来，恢复顺序不会把子会话丢下。
 *
 * ## 崩溃安全（两段写）
 *
 * ```text
 * mkdir <id>/
 * write meta.json (status: 'pending')     ← 先落「我要搬了」
 * rename sessionDir → <id>/payload/       ← 同卷原子；跨卷退化 copy+rm
 * rewrite meta.json (status: 'ready')     ← 再落「搬完了」
 * ```
 *
 * 任意一步崩掉，磁盘上都留下了可判读的痕迹：只有 `pending` 没有 `payload` =
 * 没搬成（忽略，不显示）；有 `payload` 无论状态 = 会话确实不在原位了（显示出来，
 * 且恢复按 `payload` 的实际存在判断）。**列表永不因半成品抛错**。
 *
 * @module mbsf-compaction/deleted-sessions
 */
/** 保留天数（产品口径：30 天）。 */
export declare const DELETED_RETENTION_DAYS = 30;
/** 一个要删除的会话（由网关从清单行构造，**不信任客户端的任何字段**）。 */
export interface DeleteItem {
    /** 会话 id。 */
    readonly id: string;
    /** 会话目录绝对路径（必须是 `<dshHome>/sessions/<workspace>/<id>`）。 */
    readonly sessionDir: string;
    /** 工作区目录名（恢复时用它在原位置重建路径）。 */
    readonly workspaceDir: string;
    /** 工作区真实路径（只用于显示与恢复校验）。 */
    readonly workspacePath: string;
    /** 标题（显示用）。 */
    readonly title?: string;
    /** 来源（`subagent` / `user` …）。 */
    readonly origin?: string;
    /** 父会话 id（子代理才有）。 */
    readonly parentSession?: string;
    /** 这一批里的角色：父会话 `root`，被一起带走的子代理 `child`。 */
    readonly role: 'root' | 'child';
    /** 同批其它会话的 id（显示「另有 N 个子代理会话」）。 */
    readonly siblings: readonly string[];
}
/** 备份目录里的元数据。 */
export interface DeletedSessionMeta {
    readonly version: 1;
    readonly id: string;
    readonly batchId: string;
    readonly role: 'root' | 'child';
    readonly siblings: readonly string[];
    readonly title?: string;
    readonly workspacePath: string;
    readonly workspaceDir: string;
    readonly origin?: string;
    readonly parentSession?: string;
    readonly bytes: number;
    readonly deletedAt: string;
    readonly expiresAt: string;
    readonly status: 'pending' | 'ready';
}
/** 列表里的一条（= 元数据 + 算出来的剩余天数）。 */
export interface DeletedEntry extends DeletedSessionMeta {
    /** 剩余天数（≥ 0；0 = 今天到期）。 */
    readonly remainingDays: number;
}
/** 删除结果。 */
export interface DeleteOutcome {
    readonly batchId: string;
    readonly ids: string[];
    readonly bytes: number;
}
/** 回收站根目录（默认 `~/.mbsf/deleted-sessions`）。 */
export declare function deletedRoot(base?: string): string;
/**
 * 删除一批会话（父会话 + 名下子代理），搬到回收站。
 *
 * **全有或全无**：任一项搬失败 → 已搬的回滚（搬回原位）、备份目录清掉、抛错。
 * 半删状态比删失败更危险——用户看到「没删成」，实际少了一半会话。
 */
export declare function deleteSessions(dshHome: string, items: readonly DeleteItem[], options?: {
    readonly root?: string;
    readonly now?: number;
}): DeleteOutcome;
/**
 * 列出回收站（**顺手清理到期项**）。
 *
 * 清理时机故意只放在「打开列表」这一处：用户能看见的东西才有明确的因果
 * （「我打开列表 → 提示永久清理了 N 项」），没有后台统一删除。
 */
export declare function listDeleted(options?: {
    readonly root?: string;
    readonly now?: number;
}): {
    entries: DeletedEntry[];
    purged: number;
    ignored: number;
};
/**
 * 恢复一条（父会话恢复时**整批恢复**它带走的子代理）。
 *
 * 恢复前检查目标位置：原目录已存在 → 拒绝（**绝不覆盖**——那可能是用户新建的
 * 同名会话，或另一份数据）。子代理恢复失败不回滚父会话（父回来是主诉求），
 * 失败的留在回收站里下次再试。
 */
export declare function restoreDeleted(dshHome: string, id: string, options?: {
    readonly root?: string;
    readonly now?: number;
}): {
    restored: string[];
};
/** 回收站总占用（显示用；坏目录按 0 计）。 */
export declare function deletedBytes(options?: {
    readonly root?: string;
}): number;
