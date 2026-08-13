import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { PushDeliveryService } from '../notifications/push-delivery.service';
import { Pocket, Reallocation } from '../../database/database.types';
import { coolingOffModifierFor, CoolingOffModifier } from '../../common/personality-modifiers';
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
  private readonly logger = new Logger(ReallocationsService.name);

  constructor(
    private readonly repo: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
    private readonly pushDelivery: PushDeliveryService,
  ) {}

  async create(
    userId: string,
    input: unknown,
  ): Promise<Reallocation & { cooling_off_framing?: CoolingOffModifier }> {
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

    // Balance check against the ledger, not the planning ceiling.
    const fromSummary = await this.repo.getPocketSummary(parsed.fromPocketId);
    if (fromSummary.available < parsed.amount) {
      throw new BadRequestException('Insufficient balance in the source pocket');
    }

    const coolingOffApplies = this.isEssential(fromPocket) && this.isLeisure(toPocket);

    // Money-personality modifier layer (§2.3): duration + framing come from
    // the user's plan personality rather than the flat COOLING_OFF_HOURS
    // default for everyone. Only computed when cooling-off actually
    // applies — an unaffected move doesn't need a personality lookup.
    let coolingOffModifier: CoolingOffModifier | null = null;
    if (coolingOffApplies) {
      coolingOffModifier = coolingOffModifierFor(plan.money_personality, COOLING_OFF_HOURS);
    }
    const coolingOffEndsAt = coolingOffModifier
      ? new Date(Date.now() + coolingOffModifier.hours * 60 * 60 * 1000).toISOString()
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

    // cooling_off_framing is additive, display-only context for the mobile
    // cooling-off screen (title/message tuned to the plan's money
    // personality) — undefined when cooling-off doesn't apply to this move.
    return coolingOffModifier ? { ...reallocation, cooling_off_framing: coolingOffModifier } : reallocation;
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

    // Re-check balance against the ledger right before committing — balances
    // may have changed since the reallocation was initiated (e.g. a spend
    // event reduced the source pocket's available funds during cooling-off).
    // monthly_allocation is the planning ceiling and is never mutated for
    // balance movement; all money flows live in the transactions ledger only.
    const fromSummary = await this.repo.getPocketSummary(fromPocket.id);
    if (fromSummary.available < reallocation.amount) {
      throw new BadRequestException('Insufficient balance in the source pocket');
    }

    const disciplineCost = applyingSkip ? SKIP_COOLING_OFF_COST : 0;
    const completedAt = new Date().toISOString();

    // Write ledger entries only — no mutation of monthly_allocation.
    // reallocation_out is stored as a negative amount so the repository's
    // ledger sum (allocated + reallocatedOut - spent) stays consistent.
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

    await this.pushDelivery
      .notifyReallocationConfirm(
        userId,
        updated.id,
        updated.amount,
        fromPocket.name,
        toPocket.name,
      )
      .catch((err) => {
        this.logger.warn(
          `reallocation confirm push failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

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