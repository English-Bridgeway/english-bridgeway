// Usage: npm run create-admin -- <email> "<name>" [owner|editor]
// The password is read from ADMIN_PASSWORD, or asked for on the terminal.
import readline from 'readline';
import { Admin, initDatabase, sequelize } from '../db';
import { hashPassword, validatePassword } from '../services/auth';

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a))));
}

async function main() {
  const [email, name = 'Admin', role = 'owner'] = process.argv.slice(2);
  if (!email) throw new Error('Usage: npm run create-admin -- <email> "<name>" [owner|editor]');
  const password = process.env.ADMIN_PASSWORD || (await ask('Password (min 10 characters): '));
  const problem = validatePassword(password);
  if (problem) throw new Error(problem);
  await initDatabase();
  const passwordHash = await hashPassword(password);
  const existing = await Admin.findOne({ where: { email: email.toLowerCase() } });
  if (existing) await existing.update({ passwordHash, name, role: role === 'editor' ? 'editor' : 'owner', active: true });
  else await Admin.create({ email: email.toLowerCase(), name, passwordHash, role: role === 'editor' ? 'editor' : 'owner' });
  console.log(`${existing ? 'Updated' : 'Created'} ${role} ${email}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
