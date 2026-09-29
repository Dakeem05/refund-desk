import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}

  /**
   * Email + order number is our (lightweight) proof of ownership. Whether the order doesn't exist
   * or belongs to someone else, the caller gets the same error so we don't leak which is which.
   */
  async findOrderForCustomer(email: string, orderNumber: string): Promise<Order> {
    const order = await this.orders
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.items', 'item')
      .where('o.orderNumber = :orderNumber', { orderNumber })
      .andWhere('LOWER(customer.email) = LOWER(:email)', { email })
      .orderBy('item.name', 'ASC')
      .getOne();

    if (!order) {
      throw new NotFoundException(
        "We couldn't find an order with that email address and order number. Please check both and try again.",
      );
    }
    return order;
  }
}
