-- Add map coordinates for interactive station locator
ALTER TABLE "rp_fuel_locations" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "rp_fuel_locations" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
