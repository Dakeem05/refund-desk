import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { MAX_MESSAGE_LENGTH } from '../../ai/input-screening';
import { VerifyOrderDto } from './verify-order.dto';

export class CreateRefundRequestDto extends VerifyOrderDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(10, MAX_MESSAGE_LENGTH, {
    message: `Please describe the problem in 10 to ${MAX_MESSAGE_LENGTH} characters.`,
  })
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  itemIds?: string[];
}
