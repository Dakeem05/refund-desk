import { OrderStatus } from '../../customers/entities/order.entity';
import { RefundReason, RefundStatus } from '../../refunds/entities/refund-request.entity';

/**
 * Mock CRM. Dates are "days ago" rather than fixed so the scenarios behave the same
 * whenever someone spins the project up.
 */
export interface SeedItem {
  sku: string;
  name: string;
  category: string;
  price: number; // dollars, converted to cents on insert
  quantity?: number;
  finalSale?: boolean;
  refunded?: boolean;
}

export interface SeedOrder {
  orderNumber: string;
  status: OrderStatus;
  placedDaysAgo: number;
  deliveredDaysAgo: number | null;
  items: SeedItem[];
}

export interface SeedPastRefund {
  orderNumber: string;
  daysAgo: number;
  status: RefundStatus;
  reason: RefundReason;
  message: string;
  itemSkus: string[];
}

export interface SeedCustomer {
  fullName: string;
  email: string;
  phone: string;
  customerSinceDaysAgo: number;
  isFlagged?: boolean;
  riskNote?: string;
  orders: SeedOrder[];
  pastRefunds?: SeedPastRefund[];
}

const { DELIVERED, SHIPPED, PROCESSING, CANCELLED } = OrderStatus;

export const SEED_CUSTOMERS: SeedCustomer[] = [
  {
    fullName: 'Amara Okafor',
    email: 'amara.okafor@example.com',
    phone: '+234 803 555 0142',
    customerSinceDaysAgo: 610,
    orders: [
      {
        orderNumber: 'WN-10421',
        status: DELIVERED,
        placedDaysAgo: 9,
        deliveredDaysAgo: 5,
        items: [
          { sku: 'AUD-HP-220', name: 'Aurora Wireless Headphones', category: 'Audio', price: 149 },
        ],
      },
      {
        orderNumber: 'WN-10188',
        status: DELIVERED,
        placedDaysAgo: 140,
        deliveredDaysAgo: 136,
        items: [{ sku: 'HOM-CND-03', name: 'Soy Candle Trio', category: 'Home', price: 32 }],
      },
    ],
    pastRefunds: [
      {
        orderNumber: 'WN-10188',
        daysAgo: 118,
        status: RefundStatus.DENIED,
        reason: RefundReason.CHANGED_MIND,
        message: "Don't really like the scent of these candles, can I return them?",
        itemSkus: ['HOM-CND-03'],
      },
    ],
  },
  {
    fullName: 'Daniel Mensah',
    email: 'daniel.mensah@example.com',
    phone: '+233 24 555 0199',
    customerSinceDaysAgo: 420,
    orders: [
      {
        orderNumber: 'WN-10433',
        status: DELIVERED,
        placedDaysAgo: 14,
        deliveredDaysAgo: 10,
        items: [
          {
            sku: 'SPT-SHO-44',
            name: 'Stride Trail Running Shoes (EU 44)',
            category: 'Sportswear',
            price: 119,
          },
          {
            sku: 'SPT-SOK-3P',
            name: 'Merino Running Socks 3-Pack',
            category: 'Sportswear',
            price: 24,
          },
        ],
      },
    ],
  },
  {
    fullName: 'Chloe Bennett',
    email: 'chloe.bennett@example.com',
    phone: '+44 7700 900123',
    customerSinceDaysAgo: 300,
    orders: [
      {
        orderNumber: 'WN-10440',
        status: DELIVERED,
        placedDaysAgo: 8,
        deliveredDaysAgo: 4,
        items: [
          {
            sku: 'CLO-DRS-CLR',
            name: 'Linen Wrap Dress (Clearance)',
            category: 'Clothing',
            price: 45,
            finalSale: true,
          },
        ],
      },
    ],
  },
  {
    fullName: 'Tunde Bakare',
    email: 'tunde.bakare@example.com',
    phone: '+234 805 555 0110',
    customerSinceDaysAgo: 900,
    orders: [
      {
        orderNumber: 'WN-10466',
        status: DELIVERED,
        placedDaysAgo: 7,
        deliveredDaysAgo: 3,
        items: [
          { sku: 'CMP-LAP-14P', name: 'Nimbus 14 Pro Laptop', category: 'Computers', price: 1299 },
          { sku: 'CMP-SLV-14', name: 'Laptop Sleeve 14"', category: 'Accessories', price: 29 },
        ],
      },
      {
        orderNumber: 'WN-10205',
        status: DELIVERED,
        placedDaysAgo: 95,
        deliveredDaysAgo: 91,
        items: [
          { sku: 'CMP-MSE-01', name: 'Glide Wireless Mouse', category: 'Accessories', price: 39 },
        ],
      },
    ],
  },
  {
    fullName: 'Sofia Martinez',
    email: 'sofia.martinez@example.com',
    phone: '+34 612 555 014',
    customerSinceDaysAgo: 720,
    orders: [
      {
        orderNumber: 'WN-10312',
        status: DELIVERED,
        placedDaysAgo: 66,
        deliveredDaysAgo: 61,
        items: [
          { sku: 'WRB-WCH-S2', name: 'Pulse S2 Smartwatch', category: 'Wearables', price: 199 },
        ],
      },
    ],
  },
  {
    fullName: "Liam O'Connor",
    email: 'liam.oconnor@example.com',
    phone: '+353 85 555 0177',
    customerSinceDaysAgo: 150,
    orders: [
      {
        orderNumber: 'WN-10455',
        status: DELIVERED,
        placedDaysAgo: 25,
        deliveredDaysAgo: 21,
        items: [
          {
            sku: 'OUT-TNT-2P',
            name: 'Summit 2-Person Camping Tent',
            category: 'Outdoors',
            price: 189,
          },
        ],
      },
    ],
  },
  {
    fullName: 'Ngozi Eze',
    email: 'ngozi.eze@example.com',
    phone: '+234 809 555 0133',
    customerSinceDaysAgo: 60,
    orders: [
      {
        orderNumber: 'WN-10487',
        status: DELIVERED,
        placedDaysAgo: 10,
        deliveredDaysAgo: 6,
        items: [
          { sku: 'KIT-BLN-900', name: 'VortexBlend 900W Blender', category: 'Kitchen', price: 89 },
        ],
      },
    ],
  },
  {
    fullName: 'Marcus Reid',
    email: 'marcus.reid@example.com',
    phone: '+1 415 555 0166',
    customerSinceDaysAgo: 380,
    orders: [
      {
        orderNumber: 'WN-10511',
        status: DELIVERED,
        placedDaysAgo: 6,
        deliveredDaysAgo: 2,
        items: [
          { sku: 'AUD-SPK-BT5', name: 'Boom Mini Bluetooth Speaker', category: 'Audio', price: 79 },
        ],
      },
      {
        orderNumber: 'WN-10350',
        status: DELIVERED,
        placedDaysAgo: 80,
        deliveredDaysAgo: 76,
        items: [
          {
            sku: 'CLO-JKT-RN',
            name: 'Packable Rain Jacket',
            category: 'Clothing',
            price: 95,
            refunded: true,
          },
          {
            sku: 'CLO-HOD-GR',
            name: 'Everyday Hoodie (Grey)',
            category: 'Clothing',
            price: 55,
            refunded: true,
          },
        ],
      },
      {
        orderNumber: 'WN-10392',
        status: DELIVERED,
        placedDaysAgo: 45,
        deliveredDaysAgo: 41,
        items: [
          {
            sku: 'AUD-EAR-X1',
            name: 'X1 True Wireless Earbuds',
            category: 'Audio',
            price: 129,
            refunded: true,
          },
        ],
      },
    ],
    pastRefunds: [
      {
        orderNumber: 'WN-10350',
        daysAgo: 70,
        status: RefundStatus.APPROVED,
        reason: RefundReason.NOT_AS_DESCRIBED,
        message: 'Rain jacket is not waterproof like the listing said.',
        itemSkus: ['CLO-JKT-RN'],
      },
      {
        orderNumber: 'WN-10350',
        daysAgo: 62,
        status: RefundStatus.APPROVED,
        reason: RefundReason.DAMAGED,
        message: 'Hoodie has a hole in the sleeve after one wash.',
        itemSkus: ['CLO-HOD-GR'],
      },
      {
        orderNumber: 'WN-10392',
        daysAgo: 30,
        status: RefundStatus.APPROVED,
        reason: RefundReason.DAMAGED,
        message: 'Left earbud does not charge.',
        itemSkus: ['AUD-EAR-X1'],
      },
    ],
  },
  {
    fullName: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 98765 55012',
    customerSinceDaysAgo: 30,
    orders: [
      {
        orderNumber: 'WN-10530',
        status: SHIPPED,
        placedDaysAgo: 4,
        deliveredDaysAgo: null,
        items: [
          {
            sku: 'KIT-COF-DRP',
            name: 'Brewline Drip Coffee Maker',
            category: 'Kitchen',
            price: 64,
          },
        ],
      },
    ],
  },
  {
    fullName: 'Ethan Walker',
    email: 'ethan.walker@example.com',
    phone: '+1 312 555 0188',
    customerSinceDaysAgo: 240,
    orders: [
      {
        orderNumber: 'WN-10491',
        status: DELIVERED,
        placedDaysAgo: 7,
        deliveredDaysAgo: 3,
        items: [
          {
            sku: 'GAM-CTL-PRO',
            name: 'ProPlay Wireless Controller',
            category: 'Gaming',
            price: 69,
          },
          { sku: 'GAM-HST-7', name: 'Echo 7.1 Gaming Headset', category: 'Gaming', price: 89 },
        ],
      },
    ],
  },
  {
    fullName: 'Fatima Bello',
    email: 'fatima.bello@example.com',
    phone: '+234 802 555 0155',
    customerSinceDaysAgo: 500,
    orders: [
      {
        orderNumber: 'WN-10398',
        status: DELIVERED,
        placedDaysAgo: 20,
        deliveredDaysAgo: 16,
        items: [
          {
            sku: 'FIT-MAT-6MM',
            name: 'Grip Yoga Mat 6mm',
            category: 'Fitness',
            price: 42,
            refunded: true,
          },
        ],
      },
    ],
    pastRefunds: [
      {
        orderNumber: 'WN-10398',
        daysAgo: 12,
        status: RefundStatus.APPROVED,
        reason: RefundReason.DAMAGED,
        message: 'Yoga mat came with a tear along the edge.',
        itemSkus: ['FIT-MAT-6MM'],
      },
    ],
  },
  {
    fullName: 'Kwame Asante',
    email: 'kwame.asante@example.com',
    phone: '+233 20 555 0121',
    customerSinceDaysAgo: 330,
    orders: [
      {
        orderNumber: 'WN-10502',
        status: DELIVERED,
        placedDaysAgo: 12,
        deliveredDaysAgo: 8,
        items: [
          { sku: 'HOM-LMP-ARC', name: 'Arc LED Desk Lamp', category: 'Home', price: 58 },
          {
            sku: 'HOM-PIL-CLR',
            name: 'Throw Pillows (Clearance, set of 2)',
            category: 'Home',
            price: 22,
            finalSale: true,
          },
        ],
      },
    ],
  },
  {
    fullName: 'Hannah Schmidt',
    email: 'hannah.schmidt@example.com',
    phone: '+49 151 555 01234',
    customerSinceDaysAgo: 90,
    isFlagged: true,
    riskNote: 'Two card chargebacks in the last 6 months. Review refunds manually.',
    orders: [
      {
        orderNumber: 'WN-10477',
        status: DELIVERED,
        placedDaysAgo: 9,
        deliveredDaysAgo: 5,
        items: [{ sku: 'KIT-ESP-4', name: 'Espresso Cup Set (4)', category: 'Kitchen', price: 36 }],
      },
      {
        orderNumber: 'WN-10290',
        status: CANCELLED,
        placedDaysAgo: 70,
        deliveredDaysAgo: null,
        items: [{ sku: 'KIT-KNF-8', name: 'Chef\'s Knife 8"', category: 'Kitchen', price: 74 }],
      },
    ],
  },
  {
    fullName: 'Grace Kim',
    email: 'grace.kim@example.com',
    phone: '+1 646 555 0101',
    customerSinceDaysAgo: 210,
    orders: [
      {
        orderNumber: 'WN-10519',
        status: DELIVERED,
        placedDaysAgo: 11,
        deliveredDaysAgo: 4,
        items: [
          {
            sku: 'GFT-MUG-PRS',
            name: 'Personalised Ceramic Mug',
            category: 'Gifts',
            price: 28,
            finalSale: true,
          },
        ],
      },
    ],
  },
  {
    fullName: 'Oluwaseun Adeyemi',
    email: 'seun.adeyemi@example.com',
    phone: '+234 806 555 0177',
    customerSinceDaysAgo: 45,
    orders: [
      {
        orderNumber: 'WN-10524',
        status: DELIVERED,
        placedDaysAgo: 6,
        deliveredDaysAgo: 3,
        items: [
          { sku: 'AUD-SPK-BT5', name: 'Boom Mini Bluetooth Speaker', category: 'Audio', price: 79 },
        ],
      },
      {
        orderNumber: 'WN-10535',
        status: PROCESSING,
        placedDaysAgo: 1,
        deliveredDaysAgo: null,
        items: [
          {
            sku: 'ACC-CBL-USB',
            name: 'Braided USB-C Cable 2m',
            category: 'Accessories',
            price: 15,
            quantity: 2,
          },
        ],
      },
    ],
  },
];
