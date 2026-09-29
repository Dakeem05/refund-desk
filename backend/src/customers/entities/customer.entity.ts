import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'customer_since', type: 'timestamptz' })
  customerSince: Date;

  /** Set by the (imaginary) risk team - chargebacks, abuse reports etc. */
  @Column({ name: 'is_flagged', default: false })
  isFlagged: boolean;

  @Column({ name: 'risk_note', type: 'text', nullable: true })
  riskNote: string | null;

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  get firstName(): string {
    return this.fullName.split(' ')[0];
  }
}
