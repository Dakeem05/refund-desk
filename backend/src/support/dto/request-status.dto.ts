import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';

export class RequestStatusQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;
}

export class ReferenceParamDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^RF-[A-Z0-9]{6}$/)
  reference: string;
}
