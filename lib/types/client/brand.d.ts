/** 注册侧注入的语言面（locale 服务的最小切片）。 */
export interface BrandLocaleFace {
    /** 当前语言 id（BCP 47 风格，内置 `zh` / `en`）。 */
    getId: () => string;
    /** 订阅语言变化；返回取消订阅。 */
    subscribe: (fn: () => void) => () => void;
}
/** 当前语言对应的品牌 logo（data URL）。中文 = 未必科幻，英文 = MBSF，其余回落中文。 */
export declare function useBrandLogo(face: BrandLocaleFace): string;
/** 纯函数形态（测试与无 React 场景用）。 */
export declare function selectBrandLogo(localeId: string): string;
