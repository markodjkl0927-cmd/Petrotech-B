-- Live driver location (MVP)

CREATE TABLE "driver_locations" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "heading" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "driver_locations_driverId_key" ON "driver_locations"("driverId");

ALTER TABLE "driver_locations"
ADD CONSTRAINT "driver_locations_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "drivers"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

