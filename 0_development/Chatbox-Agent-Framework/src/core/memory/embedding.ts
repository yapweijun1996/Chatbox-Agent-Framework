/**
 * 向量嵌入生成器实现
 * 提供简单的文本嵌入功能
 */

import type { EmbeddingGenerator } from './types';

/**
 * 简单的 TF-IDF 基础嵌入生成器
 * 用于演示和测试，生产环境建议使用真实的嵌入模型
 */
export class SimpleTFIDFEmbedding implements EmbeddingGenerator {
    private dimension: number;
    private vocabulary: Map<string, number> = new Map();
    private idf: Map<string, number> = new Map();

    constructor(dimension: number = 128) {
        this.dimension = dimension;
    }

    /**
     * 生成文本嵌入向量（简化实现）
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // 分词（简单按空格和标点分割）
        const tokens = this.tokenize(text);

        // 初始化向量
        const embedding = new Array(this.dimension).fill(0);

        // 使用词频生成简单向量
        for (const token of tokens) {
            const hash = this.hashString(token, this.dimension);
            embedding[hash] += 1;
        }

        // 归一化
        return this.normalize(embedding);
    }

    /**
     * 批量生成
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(text => this.generateEmbedding(text)));
    }

    /**
     * 计算余弦相似度
     */
    calculateSimilarity(embedding1: number[], embedding2: number[]): number {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embedding dimensions must match');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        if (norm1 === 0 || norm2 === 0) return 0;

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * 分词
     */
    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 0);
    }

    /**
     * 字符串哈希到固定范围
     */
    private hashString(str: string, range: number): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash) % range;
    }

    /**
     * 向量归一化
     */
    private normalize(vector: number[]): number[] {
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (norm === 0) return vector;
        return vector.map(val => val / norm);
    }
}

/**
 * 余弦相似度计算辅助函数
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * OpenAI 嵌入生成器（需要 API Key）
 * 实际使用时需要配置 OpenAI API
 */
export class OpenAIEmbedding implements EmbeddingGenerator {
    private apiKey: string;
    private model: string;
    private baseURL: string;

    constructor(apiKey: string, options: { model?: string; baseURL?: string } = {}) {
        this.apiKey = apiKey;
        this.model = options.model || 'text-embedding-3-small';
        this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const response = await fetch(`${this.baseURL}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                input: text,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const response = await fetch(`${this.baseURL}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                input: texts,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data.map((item: { embedding: number[] }) => item.embedding);
    }

    calculateSimilarity(embedding1: number[], embedding2: number[]): number {
        return cosineSimilarity(embedding1, embedding2);
    }
}
