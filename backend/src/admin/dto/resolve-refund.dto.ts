import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { RefundStatus } from '../../refunds/entities/refund-request.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ResolveRefundDto {
  @IsIn([RefundStatus.APPROVED, RefundStatus.DENIED])
  decision: RefundStatus.APPROVED | RefundStatus.DENIED;

  /** Internal note for the audit trail. */
  @Transform(trim)
  @IsString()
  @Length(5, 1000)
  note: string;

  /** Optional explanation passed through to the customer's reply. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  customerNote?: string;

  @Transform(trim)
  @IsString()
  @Length(2, 60)
  reviewer: string;
}
