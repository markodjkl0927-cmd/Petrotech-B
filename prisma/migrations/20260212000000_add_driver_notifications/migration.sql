-- Driver notification history (for in-app notification center)
CREATE TABLE "driver_notifications" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_notifications_driverId_idx" ON "driver_notifications"("driverId");
CREATE INDEX "driver_notifications_driverId_createdAt_idx" ON "driver_notifications"("driverId", "createdAt" DESC);

ALTER TABLE "driver_notifications"
ADD CONSTRAINT "driver_notifications_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
