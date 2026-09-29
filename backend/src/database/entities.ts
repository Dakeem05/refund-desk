import { Customer } from '../customers/entities/customer.entity';
import { OrderItem } from '../customers/entities/order-item.entity';
import { Order } from '../customers/entities/order.entity';
import { AuditEvent } from '../refunds/entities/audit-event.entity';
import { RefundRequest } from '../refunds/entities/refund-request.entity';

export const ENTITIES = [Customer, Order, OrderItem, RefundRequest, AuditEvent];
