import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RefundRequest } from './refund-request.entity';

export enum AuditEventType {
  REQUEST_RECEIVED = 'REQUEST_RECEIVED',
  INPUT_SCREENED = 'INPUT_SCREENED',
  AI_CLASSIFICATION = 'AI_CLASSIFICATION',
  AI_FALLBACK = 'AI_FALLBACK',
  POLICY_EVALUATED = 'POLICY_EVALUATED',
  DECISION_MADE = 'DECISION_MADE',
  REPLY_GENERATED = 'REPLY_GENERATED',
  REPLY_REJECTED = 'REPLY_REJECTED',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
}

@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Events written in the same transaction share a timestamp, this keeps them in order. */
  @Column({ type: 'integer' })
  @Generated('increment')
  seq: number;

  @Index()
  @Column({ name: 'refund_request_id' })
  refundRequestId: string;

  @ManyToOne(() => RefundRequest, (request) => request.auditTrail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refund_request_id' })
  refundRequest: RefundRequest;

  @Column({ type: 'enum', enum: AuditEventType })
  type: AuditEventType;

  /** system | ai | agent:<name> */
  @Column()
  actor: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
