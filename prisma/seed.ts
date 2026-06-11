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

  // R&P Global Energies portal
  const rpAdminPassword = await bcrypt.hash(process.env.RP_ADMIN_PASSWORD || 'rpadmin123', 10);
  await prisma.rpAdmin.upsert({
    where: { email: 'admin@randpglobalenergies.com' },
    update: {},
    create: {
      email: 'admin@randpglobalenergies.com',
      password: rpAdminPassword,
      firstName: 'R&P',
      lastName: 'Admin',
      isActive: true,
    },
  });
  console.log('R&P admin: admin@randpglobalenergies.com / rpadmin123');

  const sampleLocations = [
    {
      state: 'Texas',
      city: 'Houston',
      address: '1200 Main St',
      name: 'R&P Fuel — Downtown',
      latitude: 29.7604,
      longitude: -95.3698,
    },
    {
      state: 'Texas',
      city: 'Dallas',
      address: '450 Commerce St',
      name: 'R&P Fuel — Dallas',
      latitude: 32.7801,
      longitude: -96.804,
    },
    {
      state: 'California',
      city: 'Los Angeles',
      address: '800 Sunset Blvd',
      name: 'R&P Fuel — LA',
      latitude: 34.098,
      longitude: -118.3273,
    },
  ];
  for (const loc of sampleLocations) {
    const existing = await prisma.rpFuelLocation.findFirst({
      where: { state: loc.state, city: loc.city, address: loc.address },
    });
    if (!existing) {
      await prisma.rpFuelLocation.create({ data: loc });
    } else {
      await prisma.rpFuelLocation.update({
        where: { id: existing.id },
        data: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          name: loc.name,
        },
      });
    }
  }
  console.log('R&P sample fuel locations created');

  const jobCount = await prisma.rpCareerJob.count();
  if (jobCount === 0) {
    await prisma.rpCareerJob.create({
      data: {
        title: 'Fuel Station Associate',
        description:
          'Join our team at R&P Global Energies. We are looking for motivated associates to support daily operations at our fuel stations.',
        location: 'Houston, TX',
        department: 'Operations',
        isActive: true,
      },
    });
  }
  console.log('R&P sample career job created');

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
