-- CreateEnum
CREATE TYPE "ChargingOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargingDuration" AS ENUM ('ONE_HOUR', 'TWO_HOURS', 'FIVE_HOURS', 'TWENTY_FOUR_HOURS');

-- CreateTable
CREATE TABLE "cars" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "connectorType" TEXT NOT NULL,
    "batteryCapacity" DOUBLE PRECISION,
    "licensePlate" TEXT,
    "color" TEXT,
    "nickname" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "maxPower" DOUBLE PRECISION NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "driverId" TEXT,
    "chargingUnitId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "chargingDuration" "ChargingDuration" NOT NULL,
    "numberOfCars" INTEGER NOT NULL DEFAULT 1,
    "baseFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tip" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "ChargingOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_order_cars" (
    "id" TEXT NOT NULL,
    "chargingOrderId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charging_order_cars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charging_orders_orderNumber_key" ON "charging_orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "charging_order_cars_chargingOrderId_carId_key" ON "charging_order_cars"("chargingOrderId", "carId");

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_orders" ADD CONSTRAINT "charging_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_orders" ADD CONSTRAINT "charging_orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_orders" ADD CONSTRAINT "charging_orders_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_orders" ADD CONSTRAINT "charging_orders_chargingUnitId_fkey" FOREIGN KEY ("chargingUnitId") REFERENCES "charging_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_order_cars" ADD CONSTRAINT "charging_order_cars_chargingOrderId_fkey" FOREIGN KEY ("chargingOrderId") REFERENCES "charging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_order_cars" ADD CONSTRAINT "charging_order_cars_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
