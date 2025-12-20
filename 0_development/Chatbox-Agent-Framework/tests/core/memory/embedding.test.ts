/**
 * Embedding tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleTFIDFEmbedding, cosineSimilarity } from '../../../src/core/memory/embedding';

// ============================================================================
// Embedding tests
// ============================================================================

describe('SimpleTFIDFEmbedding', () => {
    let embedding: SimpleTFIDFEmbedding;

    beforeEach(() => {
        embedding = new SimpleTFIDFEmbedding(128);
    });

    describe('generateEmbedding', () => {
        it('should generate embedding vector', async () => {
            const vector = await embedding.generateEmbedding('Hello world');
            expect(vector).toHaveLength(128);
            expect(vector.every(v => typeof v === 'number')).toBe(true);
        });

        it('should generate normalized vectors', async () => {
            const vector = await embedding.generateEmbedding('Test text');
            const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
            expect(norm).toBeCloseTo(1, 5);
        });

        it('should generate different vectors for different text', async () => {
            const vec1 = await embedding.generateEmbedding('Hello world');
            const vec2 = await embedding.generateEmbedding('Goodbye world');

            expect(vec1).not.toEqual(vec2);
        });
    });

    describe('calculateSimilarity', () => {
        it('should calculate similarity between vectors', async () => {
            const vec1 = await embedding.generateEmbedding('machine learning');
            const vec2 = await embedding.generateEmbedding('deep learning');
            const vec3 = await embedding.generateEmbedding('cooking recipe');

            const sim12 = embedding.calculateSimilarity(vec1, vec2);
            const sim13 = embedding.calculateSimilarity(vec1, vec3);

            expect(sim12).toBeGreaterThan(sim13);
        });

        it('should return 1 for identical vectors', () => {
            const vec = [1, 0, 0, 0];
            expect(embedding.calculateSimilarity(vec, vec)).toBe(1);
        });

        it('should return 0 for orthogonal vectors', () => {
            const vec1 = [1, 0, 0, 0];
            const vec2 = [0, 1, 0, 0];
            expect(embedding.calculateSimilarity(vec1, vec2)).toBe(0);
        });
    });

    describe('batch generation', () => {
        it('should generate embeddings for multiple texts', async () => {
            const texts = ['text 1', 'text 2', 'text 3'];
            const vectors = await embedding.generateEmbeddings(texts);

            expect(vectors).toHaveLength(3);
            expect(vectors.every(v => v.length === 128)).toBe(true);
        });
    });
});

describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [1, 0, 0];
        expect(cosineSimilarity(vec1, vec2)).toBe(1);
    });

    it('should handle zero vectors', () => {
        const vec1 = [0, 0, 0];
        const vec2 = [1, 2, 3];
        expect(cosineSimilarity(vec1, vec2)).toBe(0);
    });

    it('should throw on mismatched dimensions', () => {
        const vec1 = [1, 2];
        const vec2 = [1, 2, 3];
        expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });
});
