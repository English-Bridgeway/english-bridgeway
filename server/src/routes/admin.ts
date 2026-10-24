import { Router } from 'express';
import { Op } from 'sequelize';
import { Admin, AuditLog, ContentItem, Learner, Message, Order, sequelize } from '../db';
import { asyncHandler, rateLimit, requireAdmin, requireOwner } from '../middleware';
import { adminDto, checkPassword, hashPassword, signToken, validatePassword } from '../services/auth';
import { audit } from '../services/audit';
import { COLLECTIONS, ID_FIELD, isCollection, toRecord } from '../services/content';
import { getPaymentConfig, getPolicies, getSiteSettings, paymentSettingsForAdmin, savePaymentConfig, savePolicies, saveSiteSettings } from '../services/settings';
import { testCredentials } from '../services/cashfree';
import { OrderError, orderDto, refundOrder, syncOrder } from '../services/orders';
import { getPlans, PlanError, savePlans } from '../services/plans';
import { config } from '../config';
import { adminLearnersRouter } from './adminLearners';
import { adminEbooksRouter } from './adminEbooks';

export const adminRouter = Router();

// ---- Auth ----

adminRouter.post(
  '/auth/login',
  rateLimit({ windowMs: 15 * 60_000, max: 8, key: (req) => String(req.body?.email || '').toLowerCase() }),
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const admin = await Admin.findOne({ where: { email } });
    // Same answer for a wrong email and a wrong password.
    if (!admin || !admin.active || !(await checkPassword(password, admin.passwordHash))) {
      res.status(401).json({ message: 'Email or password is incorrect.' });
      return;
    }
    await admin.update({ lastLoginAt: new Date() });
    await audit(admin.email, 'Signed in');
    res.json({ token: signToken(admin), admin: adminDto(admin), expiresInHours: config.sessionHours });
  }),
);

adminRouter.use(requireAdmin);

adminRouter.use(adminLearnersRouter);
adminRouter.use(adminEbooksRouter);

adminRouter.get('/me', (req, res) => {
  res.json(adminDto(req.admin!));
});

adminRouter.post(
  '/me/password',
  asyncHandler(async (req, res) => {
    const admin = req.admin!;
    if (!(await checkPassword(String(req.body?.current || ''), admin.passwordHash))) {
      res.status(400).json({ message: 'Your current password is incorrect.' });
      return;
    }
    const problem = validatePassword(req.body?.next);
    if (problem) {
      res.status(400).json({ message: problem });
      return;
    }
    await admin.update({ passwordHash: await hashPassword(req.body.next) });
    await audit(admin.email, 'Changed own password');
    res.json({ ok: true });
  }),
);

// ---- Dashboard ----

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const counts = (await ContentItem.findAll({
      attributes: ['collection', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['collection'],
      raw: true,
    })) as unknown as { collection: string; count: string }[];
    const content = Object.fromEntries(COLLECTIONS.map((c) => [c, Number(counts.find((r) => r.collection === c)?.count ?? 0)]));
    const [learners, total, paid, pending, revenuePaise, messages, unread, recentOrders, recentMessages] = await Promise.all([
      Learner.count(),
      Order.count(),
      Order.count({ where: { status: 'paid' } }),
      Order.count({ where: { status: 'pending' } }),
      Order.sum('amountPaise', { where: { status: 'paid' } }),
      Message.count(),
      Message.count({ where: { status: 'new' } }),
      Order.findAll({ order: [['createdAt', 'DESC']], limit: 5 }),
      Message.findAll({ order: [['createdAt', 'DESC']], limit: 5 }),
    ]);
    res.json({
      content,
      learners,
      orders: { total, paid, pending, revenue: (revenuePaise || 0) / 100 },
      messages: { total: messages, unread },
      recentOrders: recentOrders.map(orderDto),
      recentMessages,
    });
  }),
);

// ---- Content ----

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,158}$/;

adminRouter.get(
  '/content/:collection',
  asyncHandler(async (req, res) => {
    const { collection } = req.params;
    if (!isCollection(collection)) {
      res.status(404).json({ message: 'Unknown collection.' });
      return;
    }
    const rows = await ContentItem.findAll({ where: { collection }, order: [['position', 'ASC'], ['id', 'ASC']] });
    res.json(rows.map(toRecord));
  }),
);

adminRouter.put(
  '/content/:collection/:key',
  asyncHandler(async (req, res) => {
    const { collection, key: originalKey } = req.params;
    if (!isCollection(collection)) {
      res.status(404).json({ message: 'Unknown collection.' });
      return;
    }
    const data = req.body?.data;
    const key = String(req.body?.key || '').trim();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      res.status(400).json({ message: 'Missing item data.' });
      return;
    }
    if (!KEY_PATTERN.test(key)) {
      res.status(400).json({ message: 'The URL slug can use only lowercase letters, numbers and hyphens.' });
      return;
    }
    data[ID_FIELD[collection]] = key;
    const published = req.body?.published !== false;

    const saved = await sequelize.transaction(async (transaction) => {
      const existing = await ContentItem.findOne({ where: { collection, key: originalKey }, transaction });
      if (key !== originalKey && (await ContentItem.count({ where: { collection, key }, transaction }))) {
        throw new OrderError('Another item already uses this URL slug.', 409);
      }
      if (existing) {
        await existing.update({ key, data, published }, { transaction });
        return existing;
      }
      const position = ((await ContentItem.max('position', { where: { collection }, transaction })) as number | null) ?? -1;
      return ContentItem.create({ collection, key, data, published, position: position + 1 }, { transaction });
    });
    await audit(req.admin!.email, `Saved ${collection}`, key);
    res.json(toRecord(saved));
  }),
);

adminRouter.delete(
  '/content/:collection/:key',
  asyncHandler(async (req, res) => {
    const { collection, key } = req.params;
    const count = await ContentItem.destroy({ where: { collection, key } });
    if (!count) {
      res.status(404).json({ message: 'Item not found.' });
      return;
    }
    await audit(req.admin!.email, `Deleted ${collection}`, key);
    res.status(204).end();
  }),
);

adminRouter.post(
  '/content/:collection/reorder',
  asyncHandler(async (req, res) => {
    const { collection } = req.params;
    const keys: unknown = req.body?.keys;
    if (!isCollection(collection) || !Array.isArray(keys)) {
      res.status(400).json({ message: 'Invalid order.' });
      return;
    }
    await sequelize.transaction(async (transaction) => {
      for (const [position, key] of keys.entries()) {
        await ContentItem.update({ position }, { where: { collection, key: String(key) }, transaction });
      }
    });
    await audit(req.admin!.email, `Reordered ${collection}`);
    res.json({ ok: true });
  }),
);

// ---- Site settings ----

adminRouter.get(
  '/settings/site',
  asyncHandler(async (_req, res) => {
    res.json((await getSiteSettings()) ?? {});
  }),
);

adminRouter.put(
  '/settings/site',
  asyncHandler(async (req, res) => {
    const site = req.body;
    if (!site || typeof site !== 'object' || typeof site.name !== 'string' || !site.name.trim()) {
      res.status(400).json({ message: 'The site needs a name.' });
      return;
    }
    await saveSiteSettings(site);
    await audit(req.admin!.email, 'Updated site settings');
    res.json(site);
  }),
);

// ---- Business details and policy pages (owner only) ----

adminRouter.get(
  '/settings/policies',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json((await getPolicies()) ?? {});
  }),
);

adminRouter.put(
  '/settings/policies',
  requireOwner,
  asyncHandler(async (req, res) => {
    const policies = await savePolicies(req.body);
    await audit(req.admin!.email, 'Updated policies and business details');
    res.json(policies);
  }),
);

// ---- Payment gateway (owner only) ----

adminRouter.get(
  '/settings/payments',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json(await paymentSettingsForAdmin());
  }),
);

adminRouter.put(
  '/settings/payments',
  requireOwner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const mode = b.mode === 'production' ? 'production' : 'sandbox';
    await savePaymentConfig({
      enabled: Boolean(b.enabled),
      mode,
      appId: String(b.appId || ''),
      secretKey: typeof b.secretKey === 'string' ? b.secretKey : undefined,
    });
    await audit(req.admin!.email, 'Updated payment gateway settings', `${mode}, ${b.enabled ? 'enabled' : 'disabled'}`);
    res.json(await paymentSettingsForAdmin());
  }),
);

adminRouter.post(
  '/settings/payments/test',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json(await testCredentials(await getPaymentConfig()));
  }),
);

// ---- Subscription plans (owner only) ----

adminRouter.get(
  '/settings/plans',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json(await getPlans());
  }),
);

adminRouter.put(
  '/settings/plans',
  requireOwner,
  asyncHandler(async (req, res) => {
    try {
      const plans = await savePlans(req.body?.plans);
      await audit(req.admin!.email, 'Updated subscription plans', plans.map((p) => `${p.name} ₹${p.price}/${p.months}m${p.active ? '' : ' (off)'}`).join(', ').slice(0, 240));
      res.json(plans);
    } catch (err) {
      if (err instanceof PlanError) {
        res.status(400).json({ message: err.message });
        return;
      }
      throw err;
    }
  }),
);

// ---- Orders ----

adminRouter.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const rows = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 1000 });
    res.json(rows.map(orderDto));
  }),
);

adminRouter.post(
  '/orders/:orderId/sync',
  asyncHandler(async (req, res) => {
    res.json(orderDto(await syncOrder(req.params.orderId)));
  }),
);

adminRouter.post(
  '/orders/:orderId/refund',
  requireOwner,
  asyncHandler(async (req, res) => {
    const order = await refundOrder(req.params.orderId, String(req.body?.reason || ''));
    await audit(req.admin!.email, 'Refunded order', order.orderId);
    res.json(orderDto(order));
  }),
);

// ---- Messages ----

adminRouter.get(
  '/messages',
  asyncHandler(async (_req, res) => {
    res.json(await Message.findAll({ order: [['createdAt', 'DESC']], limit: 1000 }));
  }),
);

adminRouter.patch(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!['new', 'read', 'archived'].includes(status)) {
      res.status(400).json({ message: 'Invalid status.' });
      return;
    }
    const msg = await Message.findByPk(req.params.id);
    if (!msg) {
      res.status(404).json({ message: 'Message not found.' });
      return;
    }
    await msg.update({ status });
    res.json(msg);
  }),
);

adminRouter.delete(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    await Message.destroy({ where: { id: req.params.id } });
    await audit(req.admin!.email, 'Deleted message', req.params.id);
    res.status(204).end();
  }),
);

// ---- Admin accounts (owner only) ----

adminRouter.get(
  '/admins',
  requireOwner,
  asyncHandler(async (_req, res) => {
    res.json((await Admin.findAll({ order: [['createdAt', 'ASC']] })).map(adminDto));
  }),
);

adminRouter.post(
  '/admins',
  requireOwner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !String(b.name || '').trim()) {
      res.status(400).json({ message: 'Enter a name and a valid email.' });
      return;
    }
    const problem = validatePassword(b.password);
    if (problem) {
      res.status(400).json({ message: problem });
      return;
    }
    if (await Admin.findOne({ where: { email } })) {
      res.status(409).json({ message: 'An admin with this email already exists.' });
      return;
    }
    const admin = await Admin.create({
      email,
      name: String(b.name).trim(),
      role: b.role === 'owner' ? 'owner' : 'editor',
      active: b.active !== false,
      passwordHash: await hashPassword(b.password),
    });
    await audit(req.admin!.email, 'Added admin', `${email} (${admin.role})`);
    res.status(201).json(adminDto(admin));
  }),
);

adminRouter.put(
  '/admins/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) {
      res.status(404).json({ message: 'Admin not found.' });
      return;
    }
    const b = req.body ?? {};
    const role = b.role === 'owner' ? 'owner' : 'editor';
    const active = b.active !== false;
    // Never leave the site without an active owner.
    if (admin.role === 'owner' && (role !== 'owner' || !active)) {
      const owners = await Admin.count({ where: { role: 'owner', active: true, id: { [Op.ne]: admin.id } } });
      if (!owners) {
        res.status(400).json({ message: 'Keep at least one active owner.' });
        return;
      }
    }
    const update: Partial<Admin> = { name: String(b.name || admin.name).trim(), role, active };
    if (b.password) {
      const problem = validatePassword(b.password);
      if (problem) {
        res.status(400).json({ message: problem });
        return;
      }
      update.passwordHash = await hashPassword(b.password);
    }
    await admin.update(update);
    await audit(req.admin!.email, 'Updated admin', admin.email);
    res.json(adminDto(admin));
  }),
);

adminRouter.delete(
  '/admins/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.admin!.id) {
      res.status(400).json({ message: 'You cannot remove your own account.' });
      return;
    }
    const admin = await Admin.findByPk(req.params.id);
    if (admin) {
      await admin.destroy();
      await audit(req.admin!.email, 'Removed admin', admin.email);
    }
    res.status(204).end();
  }),
);

// ---- Activity log ----

adminRouter.get(
  '/audit',
  asyncHandler(async (_req, res) => {
    res.json(await AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 500 }));
  }),
);
