/**
 * 向量嵌入生成器实现
 * 提供简单的文本嵌入功能
 */
import type { EmbeddingGenerator } from './types';
/**
 * 简单的 TF-IDF 基础嵌入生成器
 * 用于演示和测试，生产环境建议使用真实的嵌入模型
 */
export declare class SimpleTFIDFEmbedding implements EmbeddingGenerator {
    private dimension;
    private vocabulary;
    private idf;
    constructor(dimension?: number);
    /**
     * 生成文本嵌入向量（简化实现）
     */
    generateEmbedding(text: string): Promise<number[]>;
    /**
     * 批量生成
     */
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    /**
     * 计算余弦相似度
     */
    calculateSimilarity(embedding1: number[], embedding2: number[]): number;
    /**
     * 分词
     */
    private tokenize;
    /**
     * 字符串哈希到固定范围
     */
    private hashString;
    /**
     * 向量归一化
     */
    private normalize;
}
/**
 * 余弦相似度计算辅助函数
 */
export declare function cosineSimilarity(vec1: number[], vec2: number[]): number;
/**
 * OpenAI 嵌入生成器（需要 API Key）
 * 实际使用时需要配置 OpenAI API
 */
export declare class OpenAIEmbedding implements EmbeddingGenerator {
    private apiKey;
    private model;
    private baseURL;
    constructor(apiKey: string, options?: {
        model?: string;
        baseURL?: string;
    });
    generateEmbedding(text: string): Promise<number[]>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    calculateSimilarity(embedding1: number[], embedding2: number[]): number;
}
//# sourceMappingURL=embedding.d.ts.map