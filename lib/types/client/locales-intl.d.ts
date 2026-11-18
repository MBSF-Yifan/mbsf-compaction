/**
 * 未必科幻页面的**非内置语种字典**（2026-11-07）
 *
 * DSH 内置只有 `zh` / `en` 两本字典；其它语言来自客户端语言包（language pack）。
 * 我们的命名空间 `settings.electronicSheep` 也一样——`zh`/`en` 之外要说日文，
 * 就得有人把日文字典交出来。本文件就是那份"交出来的东西"：8 个语种的完整
 * 译文，**由本插件随包提供**，任何人都不需要为了看中文以外的界面去改未必科幻
 * 的代码（这是 2026-11-07 一帆定的目标：降低了人家"顺手把 logo 去掉"的动机）。
 *
 * **覆盖范围必须说清楚**：这些译文只覆盖**未必科幻自己的页面/浮窗**。DSH 自身
 * 界面文案由 DSH 或对应的第三方语言包提供；选了日文时，未必科幻页面是日文、
 * DSH 自带界面按它自己的回落链走（通常是英文）——这不是本插件能替 DSH 决定的。
 *
 * **注册方式**（`ctx.locale`）：
 *  - 字典：`register(NS, 'ja', {…})` 单语形（语言包形态）。
 *  - 语言定义：`addLanguage({ id, label, fallback: 'en' })`——**只有定义了**，
 *    用户才能在语言列表里选到它。已存在同 id（别人装了同名语言包）时
 *    `addLanguage` 会抛，调用侧吞掉：别人的包优先，我们不抢。
 *
 * **译稿状态**：`zh`/`en` 是人工维护的源；其余 8 个语种是**初版机译稿**
 * （machine-drafted，2026-11-07），文案本身是"只讲效果、不含术语"的短句，
 * 所以直译的容错率很高；但母语润色仍然欢迎——改的就是下面这些文件。
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mbsf/client/locales-intl
 */
import type { MbsfLocaleKey } from './locales.ts';
/** 一本非内置语种字典。 */
export interface IntlDictionary {
    /** BCP 47 风格的语言 id（`register`/`addLanguage` 的键）。 */
    readonly id: string;
    /** 语言自己的名字（写在该语言里——语言列表就是这么显示的）。 */
    readonly label: string;
    /** 完整字典（`satisfies Record<MbsfLocaleKey, string>` 保证不漏键）。 */
    readonly dict: Record<MbsfLocaleKey, string>;
}
/** 随包提供的非内置语种（顺序 = 语言列表里的显示顺序）。 */
export declare const INTL_DICTIONARIES: readonly IntlDictionary[];
