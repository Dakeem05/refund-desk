import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AdminKeyGuard } from '../common/guards/admin-key.guard';
import { RefundQueryService } from '../refunds/refund-query.service';
import { RefundReviewService } from '../refunds/refund-review.service';
import { ListRefundsQuery } from './dto/list-refunds.query';
import { ResolveRefundDto } from './dto/resolve-refund.dto';

@Controller('admin')
@UseGuards(AdminKeyGuard)
export class AdminController {
  constructor(
    private readonly queries: RefundQueryService,
    private readonly review: RefundReviewService,
    private readonly ai: AiService,
  ) {}

  @Get('session')
  session() {
    // Lets the dashboard check a key before storing it
    return { ok: true, ai: this.ai.providerInfo };
  }

  @Get('stats')
  stats() {
    return this.queries.stats();
  }

  @Get('refund-requests')
  list(@Query() query: ListRefundsQuery) {
    return this.queries.list(query);
  }

  @Get('refund-requests/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.queries.detail(id);
  }

  @Post('refund-requests/:id/resolve')
  @HttpCode(200)
  async resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveRefundDto) {
    await this.review.resolve(id, dto);
    return this.queries.detail(id);
  }
}
