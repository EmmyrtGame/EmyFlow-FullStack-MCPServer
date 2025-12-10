import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding 50 test clients...');
  
  const clients = Array.from({ length: 50 }).map((_, i) => ({
    name: `Test Clinic ${i + 1}`,
    slug: `seed_test_${randomBytes(4).toString('hex')}`,
    isActive: Math.random() > 0.2, // 80% active
    timezone: 'America/Mexico_City',
    locations: [
        {
            name: 'center_1',
            address: '123 Test St',
            mapUrl: 'https://maps.google.com',
            google: {
                bookingCalendarId: `cal_${i}_booking`,
                availabilityCalendars: [`cal_${i}_avail`]
            }
        }
    ],
    // Empty credentials/tokens
    google: { serviceAccountPath: '' }, // REQUIRED FIELD
    meta: { accessToken: '' },
    wassenger: { apiKey: '', deviceId: '' },
    reminderTemplates: {}
  }));

  // Create one by one or createMany? 
  // createMany is supported for simple inserts, but 'locations' is JSON. 
  // Prisma supports createMany for models with JSON fields in Postgres/MySQL.
  // SQLite might be tricky but we are likely on Postgres/MySQL.
  // Safest is createMany.
  
  await prisma.client.createMany({
    data: clients as any, // Cast because 'locations' type might be strict
    skipDuplicates: true,
  });

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
