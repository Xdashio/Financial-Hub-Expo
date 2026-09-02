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
        it('accepts MSME business categories (Phase 1 MSME expansion)', () => {
            expect(index_1.PocketCategorySchema.parse('rent')).toBe('rent');
            expect(index_1.PocketCategorySchema.parse('salary')).toBe('salary');
            expect(index_1.PocketCategorySchema.parse('stock')).toBe('stock');
            expect(index_1.PocketCategorySchema.parse('supplier')).toBe('supplier');
            expect(index_1.PocketCategorySchema.parse('marketing')).toBe('marketing');
        });
        it('rejects unknown categories', () => {
            expect(() => index_1.PocketCategorySchema.parse('invalid_category')).toThrow();
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
    describe('MSME Project Schemas (Phase 3)', () => {
        describe('ProjectKindSchema', () => {
            it('accepts valid project kinds', () => {
                expect(() => index_1.ProjectKindSchema.parse('catering')).not.toThrow();
                expect(() => index_1.ProjectKindSchema.parse('wedding')).not.toThrow();
                expect(() => index_1.ProjectKindSchema.parse('contract')).not.toThrow();
                expect(() => index_1.ProjectKindSchema.parse('other')).not.toThrow();
            });
            it('rejects invalid project kinds', () => {
                expect(() => index_1.ProjectKindSchema.parse('invalid')).toThrow();
            });
        });
        describe('FundingTierSchema', () => {
            it('accepts the three required tiers', () => {
                expect(() => index_1.FundingTierSchema.parse('priorities')).not.toThrow();
                expect(() => index_1.FundingTierSchema.parse('needs')).not.toThrow();
                expect(() => index_1.FundingTierSchema.parse('wants')).not.toThrow();
            });
            it('rejects invalid tiers', () => {
                expect(() => index_1.FundingTierSchema.parse('emergency')).toThrow();
            });
        });
        describe('FundingStatusSchema', () => {
            it('accepts valid funding statuses', () => {
                expect(() => index_1.FundingStatusSchema.parse('in_progress')).not.toThrow();
                expect(() => index_1.FundingStatusSchema.parse('complete')).not.toThrow();
            });
            it('rejects invalid funding statuses', () => {
                expect(() => index_1.FundingStatusSchema.parse('pending')).toThrow();
            });
        });
        describe('ProjectStatusSchema', () => {
            it('accepts valid project statuses', () => {
                expect(() => index_1.ProjectStatusSchema.parse('draft')).not.toThrow();
                expect(() => index_1.ProjectStatusSchema.parse('active')).not.toThrow();
                expect(() => index_1.ProjectStatusSchema.parse('completed')).not.toThrow();
                expect(() => index_1.ProjectStatusSchema.parse('cancelled')).not.toThrow();
            });
            it('rejects invalid project statuses', () => {
                expect(() => index_1.ProjectStatusSchema.parse('pending')).toThrow();
            });
        });
        describe('ProjectCreateInputSchema', () => {
            it('validates a correct project creation input', () => {
                const input = {
                    name: 'Catering Event',
                    kind: 'catering',
                    contractValue: 500000,
                    tiers: {
                        priorities: 250000,
                        needs: 150000,
                        wants: 100000,
                    },
                };
                expect(() => index_1.ProjectCreateInputSchema.parse(input)).not.toThrow();
            });
            it('rejects when tier targets do not sum to contract value', () => {
                const input = {
                    name: 'Catering Event',
                    kind: 'catering',
                    contractValue: 500000,
                    tiers: {
                        priorities: 250000,
                        needs: 150000,
                        wants: 50000, // Only sums to 450000
                    },
                };
                expect(() => index_1.ProjectCreateInputSchema.parse(input)).toThrow();
            });
            it('allows small floating point tolerance for contract value matching', () => {
                const input = {
                    name: 'Catering Event',
                    kind: 'catering',
                    contractValue: 500000.005,
                    tiers: {
                        priorities: 250000,
                        needs: 150000,
                        wants: 100000, // Sums to 500000, within 0.01 tolerance
                    },
                };
                expect(() => index_1.ProjectCreateInputSchema.parse(input)).not.toThrow();
            });
            it('rejects empty tier targets', () => {
                const input = {
                    name: 'Catering Event',
                    kind: 'catering',
                    contractValue: 500000,
                    tiers: {
                        priorities: 0,
                        needs: 0,
                        wants: 0,
                    },
                };
                expect(() => index_1.ProjectCreateInputSchema.parse(input)).toThrow();
            });
        });
        describe('ProjectIncomeInputSchema', () => {
            it('validates a correct income input', () => {
                const input = {
                    amount: 250000,
                    source: 'Deposit',
                    label: 'Initial payment',
                    date: '2024-01-15',
                };
                expect(() => index_1.ProjectIncomeInputSchema.parse(input)).not.toThrow();
            });
            it('accepts income without label', () => {
                const input = {
                    amount: 250000,
                    source: 'Deposit',
                    date: '2024-01-15',
                };
                expect(() => index_1.ProjectIncomeInputSchema.parse(input)).not.toThrow();
            });
            it('rejects invalid date format', () => {
                const input = {
                    amount: 250000,
                    source: 'Deposit',
                    date: '2024-01-15T00:00:00Z', // ISO format, not date only
                };
                expect(() => index_1.ProjectIncomeInputSchema.parse(input)).toThrow();
            });
            it('rejects source that is too long', () => {
                const input = {
                    amount: 250000,
                    source: 'A'.repeat(101), // Exceeds 100 char limit
                    date: '2024-01-15',
                };
                expect(() => index_1.ProjectIncomeInputSchema.parse(input)).toThrow();
            });
        });
        describe('TierSummarySchema', () => {
            it('validates a complete tier summary', () => {
                const summary = {
                    id: '550e8400-e29b-41d4-a716-446655440001',
                    tier: 'priorities',
                    sortOrder: 1,
                    targetAmount: 250000,
                    allocatedAmount: 250000,
                    spentAmount: 180000,
                    remainingCash: 70000,
                    fundingStatus: 'complete',
                    fundingPercent: 100,
                };
                expect(() => index_1.TierSummarySchema.parse(summary)).not.toThrow();
            });
            it('validates in-progress tier', () => {
                const summary = {
                    id: '550e8400-e29b-41d4-a716-446655440002',
                    tier: 'needs',
                    sortOrder: 2,
                    targetAmount: 150000,
                    allocatedAmount: 100000,
                    spentAmount: 50000,
                    remainingCash: 50000,
                    fundingStatus: 'in_progress',
                    fundingPercent: 66.67,
                };
                expect(() => index_1.TierSummarySchema.parse(summary)).not.toThrow();
            });
        });
        describe('ProjectSummarySchema', () => {
            it('validates a complete project summary', () => {
                const summary = {
                    id: '550e8400-e29b-41d4-a716-446655440003',
                    name: 'Catering Event',
                    kind: 'catering',
                    contractValue: 500000,
                    status: 'active',
                    isActiveCascade: true,
                    tiers: [
                        {
                            id: '550e8400-e29b-41d4-a716-446655440004',
                            tier: 'priorities',
                            sortOrder: 1,
                            targetAmount: 250000,
                            allocatedAmount: 250000,
                            spentAmount: 180000,
                            remainingCash: 70000,
                            fundingStatus: 'complete',
                            fundingPercent: 100,
                        },
                        {
                            id: '550e8400-e29b-41d4-a716-446655440005',
                            tier: 'needs',
                            sortOrder: 2,
                            targetAmount: 150000,
                            allocatedAmount: 100000,
                            spentAmount: 50000,
                            remainingCash: 50000,
                            fundingStatus: 'in_progress',
                            fundingPercent: 66.67,
                        },
                        {
                            id: '550e8400-e29b-41d4-a716-446655440006',
                            tier: 'wants',
                            sortOrder: 3,
                            targetAmount: 100000,
                            allocatedAmount: 0,
                            spentAmount: 0,
                            remainingCash: 0,
                            fundingStatus: 'in_progress',
                            fundingPercent: 0,
                        },
                    ],
                    nextIncomeGoesTo: 'needs',
                    totalAllocated: 350000,
                    totalSpent: 230000,
                    totalRemaining: 120000,
                    excessPending: null,
                };
                expect(() => index_1.ProjectSummarySchema.parse(summary)).not.toThrow();
            });
            it('validates completed project with all tiers funded', () => {
                const summary = {
                    id: '550e8400-e29b-41d4-a716-446655440007',
                    name: 'Catering Event',
                    kind: 'catering',
                    contractValue: 500000,
                    status: 'completed',
                    isActiveCascade: false,
                    tiers: [
                        {
                            id: '550e8400-e29b-41d4-a716-446655440008',
                            tier: 'priorities',
                            sortOrder: 1,
                            targetAmount: 250000,
                            allocatedAmount: 250000,
                            spentAmount: 250000,
                            remainingCash: 0,
                            fundingStatus: 'complete',
                            fundingPercent: 100,
                        },
                        {
                            id: '550e8400-e29b-41d4-a716-446655440009',
                            tier: 'needs',
                            sortOrder: 2,
                            targetAmount: 150000,
                            allocatedAmount: 150000,
                            spentAmount: 150000,
                            remainingCash: 0,
                            fundingStatus: 'complete',
                            fundingPercent: 100,
                        },
                        {
                            id: '550e8400-e29b-41d4-a716-446655440010',
                            tier: 'wants',
                            sortOrder: 3,
                            targetAmount: 100000,
                            allocatedAmount: 100000,
                            spentAmount: 100000,
                            remainingCash: 0,
                            fundingStatus: 'complete',
                            fundingPercent: 100,
                        },
                    ],
                    nextIncomeGoesTo: null,
                    totalAllocated: 500000,
                    totalSpent: 500000,
                    totalRemaining: 0,
                    excessPending: null,
                };
                expect(() => index_1.ProjectSummarySchema.parse(summary)).not.toThrow();
            });
            it('rejects if tiers array does not have exactly 3 elements', () => {
                const summary = {
                    id: '550e8400-e29b-41d4-a716-446655440011',
                    name: 'Catering Event',
                    kind: 'catering',
                    contractValue: 500000,
                    status: 'active',
                    isActiveCascade: true,
                    tiers: [
                        {
                            id: '550e8400-e29b-41d4-a716-446655440012',
                            tier: 'priorities',
                            sortOrder: 1,
                            targetAmount: 250000,
                            allocatedAmount: 250000,
                            spentAmount: 180000,
                            remainingCash: 70000,
                            fundingStatus: 'complete',
                            fundingPercent: 100,
                        },
                        {
                            id: '550e8400-e29b-41d4-a716-446655440013',
                            tier: 'needs',
                            sortOrder: 2,
                            targetAmount: 150000,
                            allocatedAmount: 100000,
                            spentAmount: 50000,
                            remainingCash: 50000,
                            fundingStatus: 'in_progress',
                            fundingPercent: 66.67,
                        },
                    ], // Only 2 tiers instead of 3
                    nextIncomeGoesTo: 'needs',
                    totalAllocated: 350000,
                    totalSpent: 230000,
                    totalRemaining: 120000,
                    excessPending: null,
                };
                expect(() => index_1.ProjectSummarySchema.parse(summary)).toThrow();
            });
        });
    });
    describe('MSME Invoicing Schemas (020)', () => {
        describe('KraPinSchema', () => {
            it('accepts valid KRA PIN', () => {
                expect(() => index_1.KraPinSchema.parse('P051234567A')).not.toThrow();
                expect(() => index_1.KraPinSchema.parse('A123456789Z')).not.toThrow();
            });
            it('rejects invalid PIN', () => {
                expect(() => index_1.KraPinSchema.parse('123456789')).toThrow();
                expect(() => index_1.KraPinSchema.parse('p051234567a')).toThrow();
                expect(() => index_1.KraPinSchema.parse('P05123456A')).toThrow();
            });
        });
        describe('InvoiceStatusSchema', () => {
            it('accepts valid statuses', () => {
                expect(() => index_1.InvoiceStatusSchema.parse('draft')).not.toThrow();
                expect(() => index_1.InvoiceStatusSchema.parse('sent')).not.toThrow();
                expect(() => index_1.InvoiceStatusSchema.parse('paid')).not.toThrow();
                expect(() => index_1.InvoiceStatusSchema.parse('void')).not.toThrow();
            });
            it('rejects invalid status', () => {
                expect(() => index_1.InvoiceStatusSchema.parse('overdue')).toThrow();
            });
        });
        describe('EtimsStatusSchema', () => {
            it('accepts pending/submitted/accepted', () => {
                expect(() => index_1.EtimsStatusSchema.parse('pending')).not.toThrow();
                expect(() => index_1.EtimsStatusSchema.parse('accepted')).not.toThrow();
            });
        });
        describe('InvoiceCreateInputSchema', () => {
            it('validates correct input', () => {
                const input = { customerName: 'Wanjiku Supplies', amount: 45000, dueDate: '2026-09-20' };
                expect(() => index_1.InvoiceCreateInputSchema.parse(input)).not.toThrow();
            });
            it('validates with optional PIN and description', () => {
                const input = { customerName: 'Acme Ltd', customerPin: 'P051234567A', amount: 120000, dueDate: '2026-09-30', description: 'Cement 50 bags' };
                expect(() => index_1.InvoiceCreateInputSchema.parse(input)).not.toThrow();
            });
            it('rejects missing customerName', () => {
                expect(() => index_1.InvoiceCreateInputSchema.parse({ amount: 1000, dueDate: '2026-09-20' })).toThrow();
            });
            it('rejects non-positive amount', () => {
                expect(() => index_1.InvoiceCreateInputSchema.parse({ customerName: 'X', amount: 0, dueDate: '2026-09-20' })).toThrow();
            });
            it('rejects invalid dueDate', () => {
                expect(() => index_1.InvoiceCreateInputSchema.parse({ customerName: 'X', amount: 1000, dueDate: '20-09-2026' })).toThrow();
            });
            it('rejects invalid PIN', () => {
                expect(() => index_1.InvoiceCreateInputSchema.parse({ customerName: 'X', customerPin: 'bad', amount: 1000, dueDate: '2026-09-20' })).toThrow();
            });
        });
        describe('InvoiceUpdateInputSchema', () => {
            it('allows partial update', () => {
                expect(() => index_1.InvoiceUpdateInputSchema.parse({ customerName: 'New Name' })).not.toThrow();
                expect(() => index_1.InvoiceUpdateInputSchema.parse({ amount: 999 })).not.toThrow();
            });
        });
        describe('InvoiceSchema', () => {
            it('validates complete invoice', () => {
                const inv = {
                    id: '550e8400-e29b-41d4-a716-446655440020',
                    userId: '550e8400-e29b-41d4-a716-446655440021',
                    planId: '550e8400-e29b-41d4-a716-446655440022',
                    customerName: 'Wanjiku',
                    amount: 50000,
                    dueDate: '2026-09-20',
                    status: 'draft',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                expect(() => index_1.InvoiceSchema.parse(inv)).not.toThrow();
            });
        });
    });
    describe('MSME Stock Schemas (021)', () => {
        describe('StockItemCreateInputSchema', () => {
            it('validates correct input', () => {
                expect(() => index_1.StockItemCreateInputSchema.parse({ name: 'Cement', unitCost: 500, unitPrice: 650 })).not.toThrow();
            });
            it('validates with optional SKU and qty', () => {
                expect(() => index_1.StockItemCreateInputSchema.parse({ name: 'Cement', sku: 'CEM50', qtyOnHand: 10, unitCost: 500, unitPrice: 650, lowStockThreshold: 5 })).not.toThrow();
            });
            it('rejects missing name', () => {
                expect(() => index_1.StockItemCreateInputSchema.parse({ unitCost: 500, unitPrice: 650 })).toThrow();
            });
            it('rejects negative cost', () => {
                expect(() => index_1.StockItemCreateInputSchema.parse({ name: 'X', unitCost: -1, unitPrice: 10 })).toThrow();
            });
        });
        describe('StockMovementCreateInputSchema', () => {
            it('validates in movement', () => {
                expect(() => index_1.StockMovementCreateInputSchema.parse({ type: 'in', qty: 5 })).not.toThrow();
            });
            it('rejects zero qty', () => {
                expect(() => index_1.StockMovementCreateInputSchema.parse({ type: 'out', qty: 0 })).toThrow();
            });
            it('rejects invalid type', () => {
                expect(() => index_1.StockMovementCreateInputSchema.parse({ type: 'bad', qty: 5 })).toThrow();
            });
        });
        describe('StockItemSchema', () => {
            it('validates stock item', () => {
                const item = {
                    id: '550e8400-e29b-41d4-a716-446655440030',
                    userId: '550e8400-e29b-41d4-a716-446655440031',
                    planId: '550e8400-e29b-41d4-a716-446655440032',
                    name: 'Cement',
                    qtyOnHand: 10,
                    unitCost: 500,
                    unitPrice: 650,
                    lowStockThreshold: 5,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                expect(() => index_1.StockItemSchema.parse(item)).not.toThrow();
            });
        });
        describe('StockMovementTypeSchema', () => {
            it('accepts in/out/adjust', () => {
                expect(() => index_1.StockMovementTypeSchema.parse('in')).not.toThrow();
                expect(() => index_1.StockMovementTypeSchema.parse('out')).not.toThrow();
                expect(() => index_1.StockMovementTypeSchema.parse('adjust')).not.toThrow();
            });
        });
    });
});
