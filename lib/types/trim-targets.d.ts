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
/** 单个会话的勾选状态。 */
export interface TrimTargetState {
    /** 是否勾选（重启时是否剪这个会话）。 */
    selected: boolean;
    /** 最后一次改动的 ISO 时刻（诊断用，不参与判定）。 */
    updatedAt: string;
}
/** 勾选表路径（脑数据目录下）。 */
export declare function trimTargetsPath(): string;
/** 读整张勾选表；文件缺失/损坏 → 空表（**不抛**——坏文件不该挡住重启）。 */
export declare function loadTrimTargets(): Record<string, TrimTargetState>;
/**
 * 移除若干会话的勾选记录（删除会话时调用）。
 *
 * 为什么删除要清勾选：``trim-targets.json`` 是**独立表**，删掉的会话不会再出现在
 * 清单里，它的勾选记录就成了幽灵——「已勾 3 个会话」里有一个根本不存在，重启时
 * 剪裁器按 id 找不到日志只能跳过（多打一条 warn）。让删除顺手把记录清掉。
 */
export declare function removeTrimTargets(ids: readonly string[]): void;
/** 设置一个会话的勾选状态；返回改后的状态。 */
export declare function setTrimTarget(sessionId: string, selected: boolean): TrimTargetState;
/** 勾中的会话 id 列表（**按字面匹配**，不做任何继承/前缀推断）。 */
export declare function selectedTrimSessionIds(): string[];
/** 清单里的一行（设置页显示用）。 */
export interface TrimCandidate {
    /** 会话 id（DSH 会话目录名）。 */
    id: string;
    /** 工作区目录名（`--Users-...--` 原始形态，诊断用）。 */
    workspace: string;
    /** 工作区真实路径（从会话头 `cwd` 解出；读不到时为解码后的目录名）。 */
    workspacePath: string;
    /** 会话创建时刻（毫秒；读不到头时为 undefined）。 */
    createdAtMs?: number;
    /** 会话来源（`origin` 字段；subagent/… 便于区分）。 */
    origin?: string;
    /** 日志文件路径。 */
    logPath: string;
    /** 日志字节数。 */
    bytes: number;
    /** 日志最后修改时刻（毫秒）。 */
    mtimeMs: number;
    /**
     * 会话目录（`<dshHome>/sessions/<workspace>/<id>`）。
     *
     * 删除会话时要把**整个目录**搬走（日志 + 附属文件），不是只动日志文件——
     * 留一半残骸比不删更糟（DSH 扫到目录、读不到日志，界面上就是一行空壳）。
     */
    sessionDir: string;
    /**
     * 是否已归档（DSH 工作区的归档集合，2026-11-07 一帆要求按归档筛选）。
     *
     * 归档是 DSH 自己的概念，存在 `~/.dsh/storages/workspace.json` 的
     * `global.archivedSessionIds`；这里只是**读它的结果**，不改。
     */
    archived: boolean;
    /** 子代理会话的父会话 id（读头顺手取；主会话无此字段）。 */
    parentSession?: string;
    /** 谱系根源会话 id（自身即根时 = 自己的 id；祖先链断时 = 链上最高那个）。 */
    rootId: string;
    /**
     * 根源会话是否已归档。
     *
     * **子代理不会随主会话一起归档**（2026-11-07 一帆实测：归档主会话后，它的
     * 子代理会话在归档集合里一个都没有）。所以「这个子代理属于已关闭的对话」
     * 这件事得靠向上找根 + 读根的归档位，不能只看自己的 `archived`。
     */
    rootArchived: boolean;
    /** 祖先链断了（父会话已不在盘上）——孤儿残留，删它不会伤到任何活会话。 */
    orphan: boolean;
    /** 是否勾选。 */
    selected: boolean;
    /**
     * 会话标题（= **首条用户消息**的截断，2026-11-07 一帆「加标题列」）。
     *
     * DSH 的会话头里**没有标题字段**（只有 id/cwd/createdAt/origin），所以标题
     * 只能从正文取。取法有代价：得解压到「第一条用户消息」为止的帧——不是整份
     * 日志（大文件几百 MB 那种事不能干），但也比只读头贵。取舍见 `readSessionTitle`。
     * 读不到（空会话 / 首条不是文本 / 超出预算）时为 undefined，UI 显示占位符。
     */
    title?: string;
}
/** 还没补谱系的行（扫描阶段的结构；补谱系后才是完整 `TrimCandidate`）。 */
export type TrimCandidateCore = Omit<TrimCandidate, 'rootId' | 'rootArchived' | 'orphan'>;
/**
 * 会话目录名 → 可读路径（DSH 把非 ASCII 转义成 `~XXXX~`，UTF-16 码元十六进制）。
 *
 * ⚠️ **相邻转义共用波浪线**：`~663E~793A~5F15~` 里每个 `~` 既是上一个转义的
 * 收尾又是下一个的开头（实测目录名 `MBSF~663E~793A~5F15~64CE`）。所以正则
 * **不能**写成 `~([0-9A-Fa-f]{4})~`——那样会跳着匹配，一串汉字只剩首尾两个
 * 被解码（"未5FC5科5E7B" 这种半残结果）。正确形状 = `~XXXX` 无尾波浪线，
 * 剩下的孤立尾 `~` 最后统一剥掉。
 */
export declare function decodeWorkspaceDirName(name: string): string;
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
export declare function annotateTrimLineage(rows: readonly TrimCandidateCore[]): TrimCandidate[];
/**
 * 列出可剪裁的会话（设置页清单的数据源）。
 *
 * **上限**：按 mtime 倒序取前 `limit` 个（默认 500，2026-11-07 从 200 上调）。
 *
 * 为什么上调：清单现在不只用来勾剪裁，还是**会话管理面**——子代理会话要能被
 * 筛出来、已归档的要能删。200 会悄悄漏掉一部分（实测盘上 239 个），而「列表里
 * 没有」和「库里没有」在界面上分不开。实测 238 个全量冷读 855ms，缓存后秒回。
 */
export declare function listTrimCandidates(dshHome: string, limit?: number, archivedIds?: ReadonlySet<string>): TrimCandidate[];
