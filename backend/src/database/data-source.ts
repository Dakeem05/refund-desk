import 'reflect-metadata';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';

export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
  };
}

// Used by the TypeORM CLI (migrations) and the standalone seed script
export default new DataSource(
  buildDataSourceOptions(
    process.env.DATABASE_URL ?? 'postgres://refunddesk:refunddesk@localhost:5432/refund_desk',
  ),
);
