import { Sequelize, DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize';
import { config } from './config';

export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
});

export class Admin extends Model<InferAttributes<Admin>, InferCreationAttributes<Admin>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare name: string;
  declare passwordHash: string;
  declare role: 'owner' | 'editor';
  declare active: CreationOptional<boolean>;
  declare lastLoginAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Admin.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    passwordHash: { type: DataTypes.STRING(100), allowNull: false },
    role: { type: DataTypes.ENUM('owner', 'editor'), allowNull: false, defaultValue: 'editor' },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'admins', underscored: true },
);

// One row per lesson, word, quiz, course, blog post… `data` holds the item exactly as the
// website's TypeScript types describe it (src/types in the frontend).
export class ContentItem extends Model<InferAttributes<ContentItem>, InferCreationAttributes<ContentItem>> {
  declare id: CreationOptional<number>;
  declare collection: string;
  declare key: string;
  declare data: Record<string, unknown>;
  declare published: CreationOptional<boolean>;
  declare position: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ContentItem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    collection: { type: DataTypes.STRING(40), allowNull: false },
    key: { type: DataTypes.STRING(160), allowNull: false },
    data: { type: DataTypes.JSONB, allowNull: false },
    published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'content_items',
    underscored: true,
    indexes: [{ unique: true, fields: ['collection', 'key'] }],
  },
);

export class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare key: string;
  declare value: Record<string, unknown>;
}

Setting.init(
  {
    key: { type: DataTypes.STRING(60), primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false },
  },
  { sequelize, tableName: 'settings', underscored: true },
);

// Learners: the students who sign up on the public site (separate from admins).
export class Learner extends Model<InferAttributes<Learner>, InferCreationAttributes<Learner>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare name: string;
  declare phone: CreationOptional<string | null>;
  declare passwordHash: string;
  declare active: CreationOptional<boolean>;
  // Raised on "log out everywhere" and password changes; tokens carrying an older value stop working.
  declare tokenVersion: CreationOptional<number>;
  declare lastLoginAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Learner.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    phone: { type: DataTypes.STRING(15), allowNull: true },
    passwordHash: { type: DataTypes.STRING(100), allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'learners', underscored: true },
);

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
  declare orderId: string;
  declare userId: CreationOptional<string | null>;
  declare courseId: string;
  declare courseTitle: string;
  declare amountPaise: number;
  declare customerName: string;
  declare customerEmail: string;
  declare customerPhone: string;
  declare status: CreationOptional<OrderStatus>;
  declare gatewayPaymentId: CreationOptional<string | null>;
  declare bankReference: CreationOptional<string | null>;
  declare refundId: CreationOptional<string | null>;
  declare paidAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Order.init(
  {
    orderId: { type: DataTypes.STRING(45), primaryKey: true },
    // The learner account that bought the course. Paid orders with this id unlock the course.
    userId: { type: DataTypes.UUID, allowNull: true },
    courseId: { type: DataTypes.STRING(160), allowNull: false },
    courseTitle: { type: DataTypes.STRING(200), allowNull: false },
    amountPaise: { type: DataTypes.INTEGER, allowNull: false },
    customerName: { type: DataTypes.STRING(120), allowNull: false },
    customerEmail: { type: DataTypes.STRING(254), allowNull: false },
    customerPhone: { type: DataTypes.STRING(15), allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'), allowNull: false, defaultValue: 'pending' },
    gatewayPaymentId: { type: DataTypes.STRING(60), allowNull: true },
    bankReference: { type: DataTypes.STRING(80), allowNull: true },
    refundId: { type: DataTypes.STRING(60), allowNull: true },
    paidAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'orders', underscored: true, indexes: [{ fields: ['status'] }, { fields: ['customer_email'] }, { fields: ['user_id'] }] },
);

export class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare email: string;
  declare phone: string | null;
  declare subject: string;
  declare message: string;
  declare status: CreationOptional<'new' | 'read' | 'archived'>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Message.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    subject: { type: DataTypes.STRING(160), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('new', 'read', 'archived'), allowNull: false, defaultValue: 'new' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'messages', underscored: true },
);

export class AuditLog extends Model<InferAttributes<AuditLog>, InferCreationAttributes<AuditLog>> {
  declare id: CreationOptional<number>;
  declare adminEmail: string;
  declare action: string;
  declare target: string | null;
  declare createdAt: CreationOptional<Date>;
}

AuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    adminEmail: { type: DataTypes.STRING(254), allowNull: false },
    action: { type: DataTypes.STRING(120), allowNull: false },
    target: { type: DataTypes.STRING(240), allowNull: true },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'audit_logs', underscored: true, updatedAt: false },
);

/** Creates any missing tables. Safe to run on every start; it never drops data. */
export async function initDatabase(): Promise<void> {
  await sequelize.authenticate();
  // sync() creates missing tables but never changes existing ones, so columns added after
  // the first release are added here (idempotent, keeps the data).
  const orders = await sequelize.getQueryInterface().describeTable('orders').catch(() => null);
  if (orders && !orders.user_id) {
    await sequelize.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID');
  }
  await sequelize.sync();
}
