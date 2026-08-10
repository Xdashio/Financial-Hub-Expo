"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
describe('Shared Schemas - Pack 1', () => {
    describe('PocketCategorySchema', () => {
        it('accepts housing and family (Batch 2 category expansion)', () => {
            expect(index_1.PocketCategorySchema.parse('housing')).toBe('housing');
            expect(index_1.PocketCategorySchema.parse('family')).toBe('family');
            expect(index_1.PocketCategorySchema.parse('education')).toBe('education');
        });
        it('rejects unknown categories', () => {
            expect(() => index_1.PocketCategorySchema.parse('rent')).toThrow();
        });
    });
    describe('UserSchema', () => {
        it('validates a correct user', () => {
            const user = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                email: 'test@example.com',
                fullName: 'Test User',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            expect(() => index_1.UserSchema.parse(user)).not.toThrow();
        });
        it('rejects invalid email', () => {
            const user = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                email: 'invalid-email',
                fullName: 'Test User',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            expect(() => index_1.UserSchema.parse(user)).toThrow();
        });
    });
    describe('PocketSchema', () => {
        it('validates a correct pocket', () => {
            const pocket = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                planId: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Food & Groceries',
                kind: 'spendable',
                category: 'food',
                isTimeLocked: false,
                monthlyAllocation: 5000,
                dailyCap: 250,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            expect(() => index_1.PocketSchema.parse(pocket)).not.toThrow();
        });
        it('validates a savings pocket with time lock', () => {
            const pocket = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                planId: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Savings',
                kind: 'savings',
                isTimeLocked: true,
                lockUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                monthlyAllocation: 10000,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            expect(() => index_1.PocketSchema.parse(pocket)).not.toThrow();
        });
        it('validates a fixed expense pocket', () => {
            const pocket = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                planId: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Rent & Bills',
                kind: 'fixed',
                category: 'utilities',
                isTimeLocked: false,
                monthlyAllocation: 18000,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            expect(() => index_1.PocketSchema.parse(pocket)).not.toThrow();
        });
    });
    describe('PlanSchema', () => {
        it('validates a correct structured plan', () => {
            const plan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                type: 'structured',
                incomePattern: 'salaried',
                status: 'active',
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.PlanSchema.parse(plan)).not.toThrow();
        });
        it('validates a daily plan', () => {
            const plan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                type: 'daily',
                incomePattern: 'freelancer',
                status: 'active',
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.PlanSchema.parse(plan)).not.toThrow();
        });
        it('validates a reassigned plan', () => {
            const plan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                type: 'structured',
                incomePattern: 'salaried',
                status: 'reassigned',
                createdAt: new Date().toISOString(),
                reassignedAt: new Date().toISOString(),
            };
            expect(() => index_1.PlanSchema.parse(plan)).not.toThrow();
        });
    });
    describe('TransactionSchema', () => {
        it('validates a credit transaction (allocation)', () => {
            const transaction = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                pocketId: '123e4567-e89b-12d3-a456-426614174001',
                amount: 5000, // positive for credit
                type: 'allocation',
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.TransactionSchema.parse(transaction)).not.toThrow();
        });
        it('validates a debit transaction (spend)', () => {
            const transaction = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                pocketId: '123e4567-e89b-12d3-a456-426614174001',
                amount: -500, // negative for debit
                type: 'spend',
                merchant: 'Naivas Supermarket',
                category: 'grocery',
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.TransactionSchema.parse(transaction)).not.toThrow();
        });
        it('validates a reallocation out transaction', () => {
            const transaction = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                pocketId: '123e4567-e89b-12d3-a456-426614174001',
                amount: -200, // negative for debit
                type: 'reallocation_out',
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.TransactionSchema.parse(transaction)).not.toThrow();
        });
    });
    describe('ReallocationSchema', () => {
        it('validates a pending reallocation', () => {
            const reallocation = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
                toPocketId: '123e4567-e89b-12d3-a456-426614174002',
                amount: 500,
                reason: 'emergency',
                status: 'pending',
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.ReallocationSchema.parse(reallocation)).not.toThrow();
        });
        it('validates a reallocation with cooling off', () => {
            const reallocation = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
                toPocketId: '123e4567-e89b-12d3-a456-426614174002',
                amount: 500,
                reason: 'unexpected_expense',
                status: 'cooling_off',
                coolingOffEndsAt: new Date(Date.now() + 3600000).toISOString(),
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.ReallocationSchema.parse(reallocation)).not.toThrow();
        });
        it('validates a completed reallocation with discipline cost', () => {
            const reallocation = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
                toPocketId: '123e4567-e89b-12d3-a456-426614174002',
                amount: 500,
                reason: 'priority_shift',
                status: 'completed',
                disciplineCost: 5,
                completedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.ReallocationSchema.parse(reallocation)).not.toThrow();
        });
    });
    describe('ReallocationInputSchema', () => {
        it('validates a well-formed create request', () => {
            const input = {
                fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
                toPocketId: '123e4567-e89b-12d3-a456-426614174002',
                amount: 800,
                reason: 'unexpected_expense',
            };
            expect(() => index_1.ReallocationInputSchema.parse(input)).not.toThrow();
        });
        it('rejects a non-positive amount', () => {
            const input = {
                fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
                toPocketId: '123e4567-e89b-12d3-a456-426614174002',
                amount: 0,
                reason: 'other',
            };
            expect(() => index_1.ReallocationInputSchema.parse(input)).toThrow();
        });
        it('rejects an invalid reason', () => {
            const input = {
                fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
                toPocketId: '123e4567-e89b-12d3-a456-426614174002',
                amount: 800,
                reason: 'ran_out_early',
            };
            expect(() => index_1.ReallocationInputSchema.parse(input)).toThrow();
        });
    });
    describe('ReallocationCompleteInputSchema', () => {
        it('defaults skipCoolingOff to false when omitted', () => {
            const result = index_1.ReallocationCompleteInputSchema.parse({});
            expect(result.skipCoolingOff).toBe(false);
        });
        it('honors an explicit skipCoolingOff', () => {
            const result = index_1.ReallocationCompleteInputSchema.parse({ skipCoolingOff: true });
            expect(result.skipCoolingOff).toBe(true);
        });
    });
    describe('IncomeEventSchema', () => {
        it('validates an income event that triggers allocation', () => {
            const income = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                amount: 68000,
                source: 'Salary',
                label: 'Monthly salary',
                date: '2024-01-15',
                runAllocation: true,
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.IncomeEventSchema.parse(income)).not.toThrow();
        });
        it('validates an income event without allocation trigger', () => {
            const income = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                amount: 5000,
                source: 'Freelance',
                label: 'Side project payment',
                date: '2024-01-20',
                runAllocation: false,
                createdAt: new Date().toISOString(),
            };
            expect(() => index_1.IncomeEventSchema.parse(income)).not.toThrow();
        });
    });
    describe('Enums', () => {
        it('accepts valid plan types', () => {
            expect(() => index_1.PlanTypeSchema.parse('structured')).not.toThrow();
            expect(() => index_1.PlanTypeSchema.parse('daily')).not.toThrow();
        });
        it('rejects invalid plan types', () => {
            expect(() => index_1.PlanTypeSchema.parse('invalid')).toThrow();
        });
        it('accepts valid pocket kinds', () => {
            expect(() => index_1.PocketKindSchema.parse('savings')).not.toThrow();
            expect(() => index_1.PocketKindSchema.parse('fixed')).not.toThrow();
            expect(() => index_1.PocketKindSchema.parse('spendable')).not.toThrow();
        });
        it('rejects invalid pocket kinds', () => {
            expect(() => index_1.PocketKindSchema.parse('invalid')).toThrow();
        });
    });
});
