-- CreateTable
CREATE TABLE "rp_members" (
    "id" TEXT NOT NULL,
    "accountNumber" VARCHAR(10) NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rp_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rp_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rp_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rp_fuel_locations" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rp_fuel_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rp_career_jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rp_career_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rp_career_applications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resumeUrl" TEXT NOT NULL,
    "coverLetter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rp_career_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rp_dealership_applications" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rp_dealership_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rp_members_accountNumber_key" ON "rp_members"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rp_members_email_key" ON "rp_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rp_admins_email_key" ON "rp_admins"("email");

-- CreateIndex
CREATE INDEX "rp_fuel_locations_state_city_idx" ON "rp_fuel_locations"("state", "city");

-- AddForeignKey
ALTER TABLE "rp_career_applications" ADD CONSTRAINT "rp_career_applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "rp_career_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rp_career_applications" ADD CONSTRAINT "rp_career_applications_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "rp_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rp_dealership_applications" ADD CONSTRAINT "rp_dealership_applications_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "rp_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
