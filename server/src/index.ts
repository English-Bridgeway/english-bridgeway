import http from 'http';
import { config } from './config';
import { initDatabase } from './db';
import { createApp } from './app';
import { ensureFirstAdmin } from './services/auth';
import { seedContentIfEmpty } from './services/content';
import { attachVoice } from './services/voice';

async function main() {
  await initDatabase();
  const seeded = await seedContentIfEmpty();
  if (seeded) console.log(`Loaded ${seeded} built-in content items into the database.`);
  const created = await ensureFirstAdmin();
  if (created) console.log(`Created the first admin: ${created}`);
  const server = http.createServer(createApp());
  attachVoice(server);
  server.listen(config.port, () => {
    console.log(`English-Bridgeway API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
