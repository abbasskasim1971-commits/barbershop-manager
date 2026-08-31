export type Role = "owner" | "manager" | "barber";

export interface User {
  id: number;
  username: string;
  role: Role;
  pin?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Service {
  id: number;
  name: string;
  price: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
  lowStockThreshold: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface Sale {
  id: number;
  barberId: number;
  stationId: number;
  serviceLines: SaleLine[];
  productLines: SaleLine[];
  totalAmount: number;
  cashAmount: number;
  isDeleted: boolean;
  createdAt: string;
  createdBy: number;
}

export interface SaleLine {
  id: number;
  itemId: number;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface CommissionRate {
  id: number;
  barberId: number;
  rate: number;
  effectiveFrom: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  entityType: string;
  entityId: number;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

export interface SystemEvent {
  id: number;
  eventType: string;
  details: string;
  stationId: number;
  timestamp: string;
}

export interface InventoryAlert {
  productId: number;
  productName: string;
  currentQuantity: number;
  threshold: number;
}

export interface DayClosing {
  id: number;
  stationId: number;
  date: string;
  totalSales: number;
  actualCash: number;
  variance: number;
  closedAt: string;
  closedBy: number;
}
