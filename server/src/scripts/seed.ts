// Re-loads seed/content.json. Without --force it only fills an empty database;
// with --force it overwrites items that share a slug with the seed (others are kept).
import { initDatabase, sequelize } from '../db';
import { seedContentIfEmpty } from '../services/content';

initDatabase()
  .then(() => seedContentIfEmpty(process.argv.includes('--force')))
  .then(async (n) => {
    console.log(n ? `Loaded ${n} items.` : 'Database already has content (use --force to overwrite).');
    await sequelize.close();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
