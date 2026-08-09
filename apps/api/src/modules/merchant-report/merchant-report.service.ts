import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ReportCreateDto } from './dto/report-create.dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { MerchantReportInsert } from '../../database/database.types';

@Injectable()
export class MerchantReportService {
  constructor(private readonly repository: SupabaseRepository) {}

  async createReport(dto: ReportCreateDto, userId: string): Promise<{
    report: MerchantReportInsert;
    message: string;
  }> {
    const report: MerchantReportInsert = {
      id: uuidv4(),
      user_id: userId,
      recipient_key: dto.recipient_key,
      report_type: dto.report_type,
      description: dto.description || null,
      suggested_category: dto.suggested_category || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      reviewed_at: null,
    };

    const createdReport = await this.repository.createMerchantReport(report);
    if (!createdReport) {
      throw new Error('Failed to create merchant report');
    }

    return {
      report: createdReport,
      message: 'Thank you for your report. We will review it and improve our classification.',
    };
  }

  async getReports(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{
    reports: Array<{
      id: string;
      recipient_key: string;
      report_type: string;
      description: string | null;
      suggested_category: string | null;
      status: string;
      created_at: string;
      reviewed_at: string | null;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    let reports = await this.repository.getMerchantReportsByUserId(userId);

    // Filter by status if provided
    if (status) {
      reports = reports.filter(r => r.status === status);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedReports = reports.slice(from, to);

    const total = reports.length;
    const totalPages = Math.ceil(total / limit);

    return {
      reports: paginatedReports,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}