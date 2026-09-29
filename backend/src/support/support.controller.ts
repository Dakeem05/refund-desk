import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Env } from '../config/env.validation';
import { CustomersService } from '../customers/customers.service';
import { RefundProcessingService } from '../refunds/refund-processing.service';
import { RefundQueryService } from '../refunds/refund-query.service';
import { formatCents } from '../common/utils/money';
import { DEMO_SCENARIOS } from './demo-scenarios';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { ReferenceParamDto, RequestStatusQueryDto } from './dto/request-status.dto';
import { VerifyOrderDto } from './dto/verify-order.dto';

/** Customer-facing endpoints. No login - email + order number acts as the ownership check. */
@Controller('support')
export class SupportController {
  constructor(
    private readonly customers: CustomersService,
    private readonly processing: RefundProcessingService,
    private readonly queries: RefundQueryService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('orders/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyOrder(@Body() dto: VerifyOrderDto) {
    const order = await this.customers.findOrderForCustomer(dto.email, dto.orderNumber);
    return {
      customerFirstName: order.customer.firstName,
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt,
      deliveredAt: order.deliveredAt,
      total: formatCents(order.totalCents),
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: formatCents(item.unitPriceCents * item.quantity),
        isFinalSale: item.isFinalSale,
        alreadyRefunded: item.refundedQuantity >= item.quantity,
      })),
    };
  }

  @Post('refund-requests')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createRefundRequest(
    @Body() dto: CreateRefundRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.processing.submit({
      email: dto.email,
      orderNumber: dto.orderNumber,
      message: dto.message,
      itemIds: dto.itemIds,
      idempotencyKey: sanitiseIdempotencyKey(idempotencyKey),
    });
  }

  @Get('refund-requests/:reference')
  async getRefundRequest(
    @Param() params: ReferenceParamDto,
    @Query() query: RequestStatusQueryDto,
  ) {
    return this.queries.findForCustomer(params.reference, query.email);
  }

  @Get('demo-scenarios')
  demoScenarios() {
    if (!this.config.get('DEMO_MODE', { infer: true })) throw new NotFoundException();
    return DEMO_SCENARIOS;
  }
}

function sanitiseIdempotencyKey(key?: string): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  return /^[A-Za-z0-9-_]{8,100}$/.test(trimmed) ? trimmed : undefined;
}
