import { IsNumber, IsEnum, Min } from 'class-validator';

export class AllocatePreviewDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(['client_payment', 'cash', 'other'])
  source: 'client_payment' | 'cash' | 'other';
}