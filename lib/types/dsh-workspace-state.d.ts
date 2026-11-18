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
export declare function workspaceStatePath(dshHome: string): string;
/** 从磁盘读归档集合；读不到 → 空集合（**不抛**——状态文件坏了不该挡住清单）。 */
export declare function readArchivedSessionIds(dshHome: string): Set<string>;
