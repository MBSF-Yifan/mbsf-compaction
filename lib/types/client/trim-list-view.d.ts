/**
 * 剪裁清单的**视图变换**（搜索 / 筛选 / 排序，2026-11-07 一帆要求）。
 *
 * 为什么单独拿出来：这是清单里唯一有分支的一段逻辑，混在 JSX 里就只能靠肉眼
 * 保证「搜到 0 条时不能说成筛选失效」「排序不许改动勾选集合」。抽成纯函数后
 * 它可以在没有 DOM 的环境里被逐条验证（`tests/trim-list-view.spec.ts`）。
 *
 * 三条不变量（每条都有对应断言）：
 *   1. **只读**——输入行数组不被修改（返回重排后的新数组，行对象原样复用）；
 *   2. **勾选集合无关**——筛选/排序不改变任何行的 `selected`，也不决定写盘；
 *   3. **稳定**——同键排序保持原有相对顺序（JS `sort` 自 ES2019 起稳定，
 *      这里靠「键相等时不返回 0 以外的值」保证，不依赖引擎实现细节）。
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/trim-list-view
 */
import type { MbsfTrimRow } from './mbsf-remote.ts';
/** 排序键：最近活动 / 创建时间 / 大小 / 路径。 */
export type TrimSortKey = 'mtime' | 'created' | 'size' | 'path';
/** 筛选：全部 / 已勾选 / 未勾选。 */
export type TrimFilter = 'all' | 'selected' | 'unselected';
/**
 * 会话类型筛选（2026-11-07 一帆要求，对齐 DSH 侧栏的隐藏规则）。
 *
 * DSH 侧栏**永不显示子代理会话**（`sessionVisible` 里 `origin === 'subagent'`
 * 直接 return false）。我们的清单是盘上全量，所以这里的默认必须说清楚：
 * 「全部」= 主会话 + 子代理，不做任何隐藏——清单不是侧栏，用户要看的是盘上
 * 到底有什么。
 */
export type TrimScope = 'all' | 'main' | 'subagent';
/**
 * 归档三档（与 DSH 视图选项同名同义）：
 * - `hide`：隐藏已归档（DSH 默认）
 * - `show`：全部对话（显示已归档）
 * - `only`：仅显示已归档
 */
export type TrimArchive = 'hide' | 'show' | 'only';
/**
 * 分组方式（与 DSH 视图选项同名同义）：
 * - `workspace`：按工作区（一个工作区一组）
 * - `tree`：按工作区树（嵌套目录逐层成组）
 * - `flat`：单列表
 */
export type TrimGroupBy = 'workspace' | 'tree' | 'flat';
/** 视图参数。 */
export interface TrimViewOptions {
    /** 搜索词（大小写不敏感，匹配标题 / id / 工作区路径 / 来源）。 */
    readonly query: string;
    readonly filter: TrimFilter;
    readonly sort: TrimSortKey;
    /** true = 降序。 */
    readonly desc: boolean;
    /** 会话类型（全部 / 仅主会话 / 仅子代理）。 */
    readonly scope: TrimScope;
    /** 归档（隐藏 / 全部 / 仅归档）。 */
    readonly archive: TrimArchive;
    /** 分组方式。 */
    readonly groupBy: TrimGroupBy;
}
/**
 * 视图默认值。
 *
 * **单列表 + 体积降序**：
 * - `groupBy: 'flat'`——按工作区分组会把最大的会话打散到各组（每组各排各的），
 *   单列表让体积排序跨全部会话生效，打开即看到最该剪的那几个。
 * - `sort: 'size'` / `desc: true`——清理关心的是体积，不是活动时间。
 */
export declare const DEFAULT_TRIM_VIEW: TrimViewOptions;
/** 行是否命中搜索词。空词 = 全命中（**不**等于「没搜」——由调用方区分文案）。 */
export declare function matchesQuery(row: MbsfTrimRow, query: string): boolean;
/**
 * 搜索 + 筛选 + 排序。
 *
 * 路径按字符串比较（`localeCompare` 会随系统区域变，清单不该有这种漂移），
 * 数值键按差值比较。
 */
export declare function applyTrimView(rows: readonly MbsfTrimRow[], options: TrimViewOptions): MbsfTrimRow[];
/** 清单统计（「筛选后 N / 共 M 条」+ 筛选结果里已勾多少）。 */
export declare function summarizeView(view: readonly MbsfTrimRow[], all: readonly MbsfTrimRow[]): {
    shown: number;
    total: number;
    selectedShown: number;
    bytesShown: number;
};
/**
 * 「全选」的作用域 = **当前视图**（筛选/搜索之后的行）。
 *
 * 为什么不是全库：清单可搜索正是为了「只剪某几个大文件」，全选若越过筛选，
 * 用户会剪掉自己没看见的会话——破坏性动作不能有隐性作用域。
 */
export declare function viewSelectionGap(view: readonly MbsfTrimRow[], selected: boolean): MbsfTrimRow[];
/** 一组（分组后的一个块）。 */
export interface TrimGroup {
    /** 稳定 key（压缩状态按它记；`flat` 时为 `''`）。 */
    readonly key: string;
    /** 组标题（`flat` 时为空串——界面不画组头）。 */
    readonly label: string;
    /** 缩进层级（`tree` 用；`workspace`/`flat` 恒为 0）。 */
    readonly depth: number;
    readonly rows: MbsfTrimRow[];
}
/**
 * 按分组方式切分（**只切不改**：行对象原样复用，顺序不动）。
 *
 * `tree` 的语义：把工作区路径按 `/` 逐段展开，**有会话的目录**才出组头——
 * 空目录不占位置。逐层缩进，父目录本身没有会话时仍保留组头（用户要靠它
 * 识别「这几个子目录是一家」）。
 */
export declare function groupTrimRows(rows: readonly MbsfTrimRow[], groupBy: TrimGroupBy): TrimGroup[];
/** 组内已勾数量（组头显示「3/12」）。 */
export declare function groupSelectedCount(group: TrimGroup): number;
