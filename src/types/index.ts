import { UserRole, OrderStatus, PaymentStatus, PaymentMethod, DeliveryType } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface CreateOrderDto {
  addressId: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  deliveryDate?: Date;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  notes?: string;
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
  driverId?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

