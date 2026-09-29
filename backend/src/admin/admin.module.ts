import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RefundsModule } from '../refunds/refunds.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [RefundsModule, AiModule],
  controllers: [AdminController],
})
export class AdminModule {}
