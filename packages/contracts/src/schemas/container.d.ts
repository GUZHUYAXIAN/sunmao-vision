/**
 * 集装箱数据契约
 *
 * Container — 用户可手动添加多个集装箱，尺寸和载重独立配置
 */
import { z } from "zod";
export declare const ContainerSchema: z.ZodObject<{
    /** 唯一标识 */
    id: z.ZodString;
    /** 名称，如 "20尺标准柜" */
    name: z.ZodString;
    /** 内部长度 (mm) */
    length: z.ZodNumber;
    /** 内部宽度 (mm) */
    width: z.ZodNumber;
    /** 内部高度 (mm) */
    height: z.ZodNumber;
    /** 最大载货重量 (kg) */
    maxPayload: z.ZodNumber;
    /**
     * 集装箱自身重量 / 皮重 (kg)
     *
     * 用户不输入时默认为 0。
     * 当皮重为 0 时：毛重 = 净重。
     */
    tareWeight: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    length: number;
    width: number;
    height: number;
    name: string;
    maxPayload: number;
    tareWeight: number;
}, {
    id: string;
    length: number;
    width: number;
    height: number;
    name: string;
    maxPayload: number;
    tareWeight?: number | undefined;
}>;
export type Container = z.infer<typeof ContainerSchema>;
//# sourceMappingURL=container.d.ts.map