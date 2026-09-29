import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { RefundsModule } from '../refunds/refunds.module';
import { SupportController } from './support.controller';

@Module({
  imports: [CustomersModule, RefundsModule],
  controllers: [SupportController],
})
export class SupportModule {}
