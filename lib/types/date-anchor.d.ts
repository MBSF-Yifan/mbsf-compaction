import type { UserMessage } from '@deepseek-ai/dsh-llm';
import { DATE_ANCHOR_PREFIX } from '@mbsf/core';
export { DATE_ANCHOR_PREFIX };
/** 日期锚点消息文本前缀（幂等审计 + 校验跳过 + 用户可见共用——与 INJECT_PREFIX
 *  同角色：压缩侧/足迹侧识别锚点消息自身。常量定义在 mbsf-core 单一来源，
 *  此处 re-export 供调用方引用）。 */
/** 时区解析结果（来源诚实标注——锚文据此声明坐标从哪来）。 */
export interface TimeZoneResolution {
    /** IANA 时区名（如 'Asia/Shanghai'）。 */
    timeZone: string;
    /** 来源：浏览器（DSH 提供）/ 进程（本机时区兜底）。 */
    origin: 'browser' | 'process';
}
/** 解析锚点时区：浏览器时区优先（本步消息）→ 会话缓存 → 进程时区兜底。
 *  @param messages - 本步 claimed 消息（pre-step payload）。
 *  @param cached - 会话级缓存（首次解析成功后复用——后续步骤无 user-rpc
 *                  消息时不再退回进程时区，保持同一会话坐标一致）。
 *  @returns 时区 + 来源。 */
export declare function resolveTimeZone(messages: readonly unknown[] | undefined, cached?: string): TimeZoneResolution;
/** 时间戳 → 锚点时刻串（ISO 形态 + 数值偏移 + IANA 区名）：
 *  `2026-09-20T01:02:34+08:00[Asia/Shanghai]`。
 *  与 DSH 官方 time-context 同形态（数值偏移 + 区名双写——偏移定位绝对时刻，
 *  区名定位「当地几点」，两者都在才不产生歧义）。 */
export declare function fmtDateTime(ts: number, timeZone?: string): string;
/** 构造日期锚点消息：当前时刻（带时区）+ 本地日期 + 今日记忆文件名。
 *  @param now - 时间戳（默认 Date.now()，可注入便于测试）。
 *  @param zone - 时区解析结果（缺省 = 进程时区——调用侧通常传 resolveTimeZone）。
 *  @returns 锚点 UserMessage（source = ANCHOR_SOURCE，压缩侧可跳过）。 */
export declare function buildDateAnchorMessage(now?: number, zone?: TimeZoneResolution): UserMessage;
/**
 * 输出日期校验（2026-09-01 日期编造事故固化）：扫描文本中 > today 的日期
 * （伪坐标——锚点之外自造的未建立坐标）。判定 = 离散序比较（字典序 = 时间
 * 序），只抓疑似不冒充确证：未来日期可能是计划/外部引用，调用侧（index.ts）
 * 以警告提示 + 声明可忽略，绝不拦截。
 * @param text - 待扫文本（assistant 输出）。
 * @param today - 今天（YYYY-MM-DD，锚点同源）。
 * @returns 命中的未来日期（YYYY-MM-DD，去重保序）。
 */
export declare function scanFutureDates(text: string, today: string): string[];
/** 时间戳 → 本地 YYYY-MM-DD（坐标行用——折叠统计行的日期同构；导出供
 *  日期锚幂等比较用）。用进程时区（既有调用方语义不变）。 */
export declare function fmtDate(ts: number): string;
/** 时间戳 → 指定时区的 YYYY-MM-DD（2026-09-20 加时区——锚点日期必须与锚点
 *  时刻同一时区：否则跨时区边界时锚说 09-20、校验按进程时区算 09-19，
 *  同一坐标两个值 = 伪坐标）。时区非法/格式化失败退回 fmtDate。 */
export declare function fmtDateInZone(ts: number, timeZone?: string): string;
