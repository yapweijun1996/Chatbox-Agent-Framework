import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
    extractSchemaProperties,
    extractRequiredFields,
    zodTypeToJsonType,
    buildOpenAIToolsList,
} from '../../src/core/schema-utils';

describe('schema-utils', () => {
    describe('extractSchemaProperties', () => {
        it('should extract properties from Zod object schema', () => {
            const schema = z.object({
                name: z.string().describe('User name'),
                age: z.number().describe('User age'),
            });

            const props = extractSchemaProperties(schema);

            expect(props).toHaveProperty('name');
            expect(props).toHaveProperty('age');
            expect(props.name.type).toBe('string');
            expect(props.age.type).toBe('number');
        });

        it('should return empty object for null schema', () => {
            expect(extractSchemaProperties(null)).toEqual({});
        });

        it('should return empty object for invalid schema', () => {
            expect(extractSchemaProperties({ invalid: true })).toEqual({});
        });

        it('should handle nested objects', () => {
            const schema = z.object({
                user: z.object({
                    name: z.string(),
                }),
            });

            const props = extractSchemaProperties(schema);
            expect(props).toHaveProperty('user');
            expect(props.user.type).toBe('object');
        });
    });

    describe('extractRequiredFields', () => {
        it('should extract required fields', () => {
            const schema = z.object({
                required: z.string(),
                optional: z.string().optional(),
            });

            const required = extractRequiredFields(schema);

            expect(required).toContain('required');
            expect(required).not.toContain('optional');
        });

        it('should return empty array for null schema', () => {
            expect(extractRequiredFields(null)).toEqual([]);
        });

        it('should handle all optional fields', () => {
            const schema = z.object({
                a: z.string().optional(),
                b: z.number().optional(),
            });

            const required = extractRequiredFields(schema);
            expect(required).toHaveLength(0);
        });
    });

    describe('zodTypeToJsonType', () => {
        it('should convert Zod types to JSON Schema types', () => {
            expect(zodTypeToJsonType('ZodString')).toBe('string');
            expect(zodTypeToJsonType('ZodNumber')).toBe('number');
            expect(zodTypeToJsonType('ZodBoolean')).toBe('boolean');
            expect(zodTypeToJsonType('ZodArray')).toBe('array');
            expect(zodTypeToJsonType('ZodObject')).toBe('object');
        });

        it('should default to string for unknown types', () => {
            expect(zodTypeToJsonType('ZodUnknown')).toBe('string');
            expect(zodTypeToJsonType('CustomType')).toBe('string');
        });
    });

    describe('buildOpenAIToolsList', () => {
        it('should build tools list from registry', () => {
            const mockRegistry = {
                list: () => ['tool1', 'tool2'],
                get: (name: string) => ({
                    description: `Description for ${name}`,
                    inputSchema: z.object({ param: z.string() }),
                }),
            };

            const tools = buildOpenAIToolsList(mockRegistry);

            expect(tools).toHaveLength(2);
            expect(tools[0].type).toBe('function');
            expect(tools[0].function.name).toBe('tool1');
            expect(tools[1].function.name).toBe('tool2');
        });

        it('should exclude specified tools', () => {
            const mockRegistry = {
                list: () => ['tool1', 'lm-studio-llm', 'tool2'],
                get: (name: string) => ({
                    description: `Description for ${name}`,
                    inputSchema: z.object({}),
                }),
            };

            const tools = buildOpenAIToolsList(mockRegistry);

            expect(tools).toHaveLength(2);
            expect(tools.map(t => t.function.name)).not.toContain('lm-studio-llm');
        });

        it('should handle empty registry', () => {
            const mockRegistry = {
                list: () => [],
                get: () => null,
            };

            const tools = buildOpenAIToolsList(mockRegistry);
            expect(tools).toHaveLength(0);
        });
    });
});
