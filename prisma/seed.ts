import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create products
  const products = [
    {
      name: 'Gasoline',
      description: 'Premium gasoline for cars and motorcycles',
      pricePerLiter: 1.25,
      unit: 'liter',
      isAvailable: true,
    },
    {
      name: 'Diesel',
      description: 'Diesel fuel for trucks and heavy machinery',
      pricePerLiter: 1.15,
      unit: 'liter',
      isAvailable: true,
    },
    {
      name: 'Kerosene',
      description: 'Kerosene for heating and lighting',
      pricePerLiter: 0.95,
      unit: 'liter',
      isAvailable: true,
    },
    {
      name: 'LPG',
      description: 'Liquefied Petroleum Gas for cooking and heating',
      pricePerLiter: 0.85,
      unit: 'liter',
      isAvailable: true,
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name },
    });

    if (!existing) {
      await prisma.product.create({
        data: product,
      });
    } else {
      await prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
    }
  }

  console.log('Products created!');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@petrotech.com' },
    update: {},
    create: {
      email: 'admin@petrotech.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Admin user created! Email: admin@petrotech.com, Password: admin123');

  // Create sample driver
  const driverPassword = await bcrypt.hash('driver123', 10);
  await prisma.driver.upsert({
    where: { email: 'driver1@petrotech.com' },
    update: {
      password: driverPassword,
    },
    create: {
      email: 'driver1@petrotech.com',
      password: driverPassword,
      firstName: 'John',
      lastName: 'Driver',
      phone: '+1234567890',
      licenseNumber: 'DL123456',
      vehicleType: 'Tanker',
      vehicleNumber: 'TNK-001',
      isAvailable: true,
      isActive: true,
    },
  });

  console.log('Sample driver created! Email: driver1@petrotech.com, Password: driver123');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
