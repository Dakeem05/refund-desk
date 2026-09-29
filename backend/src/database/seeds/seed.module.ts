import { Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Env } from '../../config/env.validation';
import { seedDatabase } from './seeder';

@Injectable()
class SeedOnStart implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get('SEED_ON_START', { infer: true })) return;
    const seeded = await this.dataSource.transaction((manager) => seedDatabase(manager));
    this.logger.log(
      seeded ? 'Seeded mock customers and orders' : 'Data already present, skipping seed',
    );
  }
}

@Module({ providers: [SeedOnStart] })
export class SeedModule {}
