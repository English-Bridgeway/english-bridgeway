import { AuditLog } from '../db';

export async function audit(adminEmail: string, action: string, target?: string | null): Promise<void> {
  try {
    await AuditLog.create({ adminEmail, action, target: target ? target.slice(0, 240) : null });
  } catch {
    // Never fail an admin action because the log write failed.
  }
}
