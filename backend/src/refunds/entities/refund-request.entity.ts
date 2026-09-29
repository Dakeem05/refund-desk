import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { Order } from '../../customers/entities/order.entity';
import type { PolicyCheck } from '../../policy/policy.types';
import type { RequestClassification } from '../../ai/ai.types';
import { AuditEvent } from './audit-event.entity';

export enum RefundStatus {
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  ESCALATED = 'ESCALATED',
}

export enum RefundReason {
  DAMAGED = 'DAMAGED',
  WRONG_ITEM = 'WRONG_ITEM',
  NOT_AS_DESCRIBED = 'NOT_AS_DESCRIBED',
  NOT_RECEIVED = 'NOT_RECEIVED',
  CHANGED_MIND = 'CHANGED_MIND',
  OTHER = 'OTHER',
}

@Entity('refund_requests')
export class RefundRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human friendly id we show to customers, e.g. RF-7K2M9Q */
  @Index({ unique: true })
  @Column()
  reference: string;

  @Index({ unique: true, where: 'idempotency_key IS NOT NULL' })
  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Index()
  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'customer_message', type: 'text' })
  customerMessage: string;

  @Column({ name: 'requested_item_ids', type: 'jsonb', default: () => "'[]'" })
  requestedItemIds: string[];

  @Column({ name: 'approved_item_ids', type: 'jsonb', default: () => "'[]'" })
  approvedItemIds: string[];

  @Column({ type: 'enum', enum: RefundReason, nullable: true })
  reason: RefundReason | null;

  /** What the pipeline decided, never changes after creation. */
  @Column({
    name: 'automated_decision',
    type: 'enum',
    enum: RefundStatus,
    enumName: 'refund_status',
  })
  automatedDecision: RefundStatus;

  /** Where the request is now - same as automatedDecision until a human resolves it. */
  @Index()
  @Column({ type: 'enum', enum: RefundStatus, enumName: 'refund_status' })
  status: RefundStatus;

  @Column({ name: 'decision_code' })
  decisionCode: string;

  @Column({ name: 'refund_amount_cents', type: 'integer', default: 0 })
  refundAmountCents: number;

  @Column({ name: 'requested_amount_cents', type: 'integer', default: 0 })
  requestedAmountCents: number;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  flags: string[];

  @Column({ type: 'jsonb', nullable: true })
  classification: RequestClassification | null;

  @Column({ name: 'policy_checks', type: 'jsonb', default: () => "'[]'" })
  policyChecks: PolicyCheck[];

  @Column({ name: 'customer_reply', type: 'text', nullable: true })
  customerReply: string | null;

  @Column({ name: 'ai_provider', type: 'varchar', nullable: true })
  aiProvider: string | null;

  @Column({ name: 'ai_model', type: 'varchar', nullable: true })
  aiModel: string | null;

  @Column({ name: 'processing_ms', type: 'integer', nullable: true })
  processingMs: number | null;

  @Column({ name: 'resolved_by', type: 'varchar', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @OneToMany(() => AuditEvent, (event) => event.refundRequest)
  auditTrail: AuditEvent[];

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
