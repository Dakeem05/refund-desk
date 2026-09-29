import dataSource from '../data-source';
import { seedDatabase } from './seeder';

async function run() {
  await dataSource.initialize();
  await dataSource.runMigrations();
  const seeded = await dataSource.transaction((manager) => seedDatabase(manager));
  console.log(seeded ? 'Seed complete.' : 'Database already has data - nothing to do.');
  await dataSource.destroy();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
