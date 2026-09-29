import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  sku: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents: number;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ name: 'is_final_sale', default: false })
  isFinalSale: boolean;

  @Column({ name: 'refunded_quantity', type: 'integer', default: 0 })
  refundedQuantity: number;

  get refundableQuantity(): number {
    return Math.max(this.quantity - this.refundedQuantity, 0);
  }
}
