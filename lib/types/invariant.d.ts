/**
 * 包级 invariant 伴生插件（2026-09-27 合并重构时随浏览器半一起并入）。
 *
 * 与 ui-015 的同名文件等价，只是 PACKAGE_NAME 换成引擎包——invariant 的语义是
 * 「本包声明自己的运行时不变式」，所有权按**包名**登记，所以合并后必须用引擎包名，
 * 否则两半归不到同一个包。
 *
 * @module mbsf-compaction/invariant
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis companion plugin name. */
export declare const name = "compaction-mbsf-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/** Register this package's invariant companion. */
export declare const apply: (ctx: Context) => Promise<() => void>;
