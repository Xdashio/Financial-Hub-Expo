import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { Pocket, Reallocation } from '../../database/database.types';
import {
  ReallocationInputSchema,
  ReallocationInput,
  ReallocationCompleteInputSchema,
} from '@financial-hub/shared';

// Cooling-off applies only to essential -> discretionary-leisure moves, per
// PRD §3.4: Essential is the Fixed Expenses pocket or the Food category;
// Leisure is the Personal & Leisure category. Everything else (e.g.
// Food -> Transport) completes immediately.
const ESSENTIAL_CATEGORY = 'food';
const LEISURE_CATEGORY = 'leisure';

// Default cooling-off length. PRD allows 1-2h, configurable; 1h is the
// documented default.
const COOLING_OFF_HOURS = 1;

// Discipline-score cost of skipping the cooling-off wait (PRD §3.4).
const SKIP_COOLING_OFF_COST = 5;

@Injectable()
export class ReallocationsService {
  constructor(
    private readonly repo: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
  ) {}

  async create(userId: string, input: unknown): Promise<Reallocation> {
    const parsed = this.parseCreateInput(input);

    if (parsed.fromPocketId === parsed.toPocketId) {
      throw new BadRequestException('Source and destination pockets must be different');
    }

    const plan = await this.repo.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan for this user');
    }

    const [fromPocket, toPocket] = await Promise.all([
      this.repo.getPocketById(parsed.fromPocketId),
      this.repo.getPocketById(parsed.toPocketId),
    ]);

    if (!fromPocket || !toPocket) {
      throw new NotFoundException('Pocket not found');
    }
    if (fromPocket.plan_id !== plan.id || toPocket.plan_id !== plan.id) {
      throw new ForbiddenException('Both pockets must belong to your active plan');
    }

    if (this.isTimeLocked(fromPocket)) {
      throw new ForbiddenException('This pocket is time-locked and cannot be used as a source');
    }

    if (fromPocket.monthly_allocation < parsed.amount) {
      throw new BadRequestException('Insufficient balance in the source pocket');
    }

    const coolingOffApplies = this.isEssential(fromPocket) && this.isLeisure(toPocket);
    const coolingOffEndsAt = coolingOffApplies
      ? new Date(Date.now() + COOLING_OFF_HOURS * 60 * 60 * 1000).toISOString()
      : null;

    const reallocation = await this.repo.createReallocation({
      id: uuidv4(),
      from_pocket_id: fromPocket.id,
      to_pocket_id: toPocket.id,
      amount: parsed.amount,
      reason: parsed.reason,
      status: coolingOffApplies ? 'cooling_off' : 'pending',
      cooling_off_ends_at: coolingOffEndsAt,
      discipline_cost: 0,
    });
    if (!reallocation) {
      throw new BadRequestException('Failed to create reallocation');
    }

    await this.repo.createBehaviorEvent({
      user_id: userId,
      type: 'reallocation_initiated',
      payload: {
        reallocationId: reallocation.id,
        fromPocket: fromPocket.name,
        toPocket: toPocket.name,
        amount: parsed.amount,
        reason: parsed.reason,
        status: reallocation.status,
      },
    });

    return reallocation;
  }

  async complete(userId: string, reallocationId: string, input: unknown): Promise<Reallocation> {
    const { skipCoolingOff } = ReallocationCompleteInputSchema.parse(input ?? {});

    const reallocation = await this.repo.getReallocationById(reallocationId);
    if (!reallocation) {
      throw new NotFoundException('Reallocation not found');
    }
    if (reallocation.status === 'completed' || reallocation.status === 'skipped') {
      throw new BadRequestException('This reallocation has already been resolved');
    }

    const [fromPocket, toPocket] = await Promise.all([
      this.repo.getPocketById(reallocation.from_pocket_id),
      this.repo.getPocketById(reallocation.to_pocket_id),
    ]);
    if (!fromPocket || !toPocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(fromPocket, userId);

    const applyingSkip = reallocation.status === 'cooling_off' && skipCoolingOff;
    if (reallocation.status === 'cooling_off' && !skipCoolingOff) {
      const endsAt = reallocation.cooling_off_ends_at ? new Date(reallocation.cooling_off_ends_at) : null;
      if (!endsAt || endsAt.getTime() > Date.now()) {
        throw new BadRequestException('This move is still in its cooling-off period');
      }
    }

    // Balances may have moved since the reallocation was initiated (e.g. a
    // fresh allocation pass) — re-check right before committing the move.
    if (fromPocket.monthly_allocation < reallocation.amount) {
      throw new BadRequestException('Insufficient balance in the source pocket');
    }

    const disciplineCost = applyingSkip ? SKIP_COOLING_OFF_COST : 0;
    const completedAt = new Date().toISOString();

    await Promise.all([
      this.repo.updatePocket(fromPocket.id, {
        monthly_allocation: fromPocket.monthly_allocation - reallocation.amount,
      }),
      this.repo.updatePocket(toPocket.id, {
        monthly_allocation: toPocket.monthly_allocation + reallocation.amount,
      }),
    ]);

    await this.repo.createTransactions([
      { pocket_id: fromPocket.id, amount: -reallocation.amount, type: 'reallocation_out' },
      { pocket_id: toPocket.id, amount: reallocation.amount, type: 'reallocation_in' },
    ]);

    const updated = await this.repo.updateReallocation(reallocation.id, {
      status: 'completed',
      completed_at: completedAt,
      discipline_cost: disciplineCost,
    });
    if (!updated) {
      throw new BadRequestException('Failed to complete reallocation');
    }

    await this.repo.createBehaviorEvent({
      user_id: userId,
      type: 'reallocation_completed',
      payload: {
        reallocationId: reallocation.id,
        fromPocket: fromPocket.name,
        toPocket: toPocket.name,
        amount: reallocation.amount,
        disciplineCost,
      },
    });

    if (disciplineCost > 0) {
      await this.applyDisciplineCost(userId, disciplineCost);
    }

    return updated;
  }

  async getForUser(userId: string): Promise<Reallocation[]> {
    return this.repo.getReallocationsByUserId(userId);
  }

  private async applyDisciplineCost(userId: string, cost: number): Promise<void> {
    await this.disciplineScore.applyDelta(userId, -cost);
  }

  private isEssential(pocket: Pocket): boolean {
    return pocket.kind === 'fixed' || pocket.category === ESSENTIAL_CATEGORY;
  }

  private isLeisure(pocket: Pocket): boolean {
    return pocket.category === LEISURE_CATEGORY;
  }

  private isTimeLocked(pocket: Pocket): boolean {
    if (!pocket.is_time_locked) return false;
    if (!pocket.lock_until) return true;
    return new Date(pocket.lock_until).getTime() > Date.now();
  }

  private async assertOwnership(pocket: Pocket, userId: string): Promise<void> {
    const plan = await this.repo.getPlanById(pocket.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this reallocation');
    }
  }

  private parseCreateInput(input: unknown): ReallocationInput {
    const result = ReallocationInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    return result.data;
  }
}