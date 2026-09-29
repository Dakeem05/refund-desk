import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { CustomersModule } from '../customers/customers.module';
import { PolicyModule } from '../policy/policy.module';
import { AuditEvent } from './entities/audit-event.entity';
import { RefundRequest } from './entities/refund-request.entity';
import { RefundProcessingService } from './refund-processing.service';
import { RefundQueryService } from './refund-query.service';
import { RefundReviewService } from './refund-review.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefundRequest, AuditEvent]),
    CustomersModule,
    PolicyModule,
    AiModule,
  ],
  providers: [RefundProcessingService, RefundReviewService, RefundQueryService],
  exports: [RefundProcessingService, RefundReviewService, RefundQueryService],
})
export class RefundsModule {}
