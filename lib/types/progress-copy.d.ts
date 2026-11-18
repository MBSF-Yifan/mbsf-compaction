/**
 * 清理进度页的多语言文案（2026-11-07）
 *
 * 为什么单独一份而不是复用 `client/locales.ts`：进度页跑在 **runner 进程**里
 * （DSH 已经停了，没有任何客户端运行时可用），它拿不到 `ctx.locale`。所以这里
 * 是一份独立的、只含进度页所需十来个键的小字典，语言由两处决定：
 *   1. 设置页开窗时带的 `?lang=`（用户当时的界面语言，最准）；
 *   2. 手输 URL 时退到浏览器的 `Accept-Language`（至少不硬性中文）。
 * 都没有 → 中文。
 *
 * **品牌与版权不翻译**：标题里的产品名两种语言都是 `未必科幻MBSF`。
 *
 * @module mbsf-compaction/progress-copy
 */
/** 进度页文案的键。 */
export interface ProgressCopy {
    /** 浏览器标签页标题。 */
    title: string;
    /** 品牌字（页面顶部）。 */
    wordmark: string;
    /** 阶段标签。 */
    stopping: string;
    strip: string;
    prune: string;
    backup: string;
    starting: string;
    done: string;
    ready: string;
    failed: string;
    /** 完成提示（含 3 秒自关说明）。 */
    doneOk: string;
    /** 未自关时的回跳链接。 */
    back: string;
    /** 失败时的「先确认状态」链接。 */
    retry: string;
}
/**
 * 解析要用哪种语言：显式 `lang` 参数 > `Accept-Language` 首个命中 > 中文。
 *
 * `zh-CN` / `zh-Hans` 这类带地区的标签回落到 `zh`；无法识别的一律回中文
 * （进度页只有几行字，读不懂母语时中文/英文都得看得懂至少一个）。
 */
export declare function progressCopyFor(lang: string | undefined, acceptLanguage?: string): ProgressCopy;
