import { PrismaClient } from '@prisma/client';
import { clients } from '../config/clients';
import { encrypt } from '../admin/utils/crypto.util';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting migration...');

  for (const [slug, config] of Object.entries(clients)) {
    console.log(`Migrating client: ${slug}`);

    // Prepare data with encryption for sensitive fields
    const clientData: any = {
      slug,
      name: slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      isActive: true,
      timezone: config.timezone,
      availabilityStrategy: config.availabilityStrategy || 'PER_LOCATION',
      
      // JSON fields
      location: config.location,
      locations: config.locations,
      reminderTemplates: config.reminderTemplates,
      
      // Sensitive fields needing encryption inside JSON
      google: {
        ...config.google,
        // config.google.serviceAccountPath is kept as string in JSON for reference, 
        // but the actual file content goes to ServiceAccount table
      },
      meta: {
        ...config.meta,
        accessToken: config.meta.accessToken ? encrypt(config.meta.accessToken) : ''
      },
      wassenger: {
        ...config.wassenger,
        apiKey: config.wassenger.apiKey ? encrypt(config.wassenger.apiKey) : ''
      }
    };

    // Upsert Client
    const client = await prisma.client.upsert({
      where: { slug },
      update: clientData,
      create: clientData
    });

    console.log(`Client ${slug} migrated (ID: ${client.id})`);

    // Handle Service Account File
    if (config.google.serviceAccountPath) {
      const filePath = path.resolve(process.cwd(), config.google.serviceAccountPath);
      if (fs.existsSync(filePath)) {
        console.log(`Processing Service Account: ${config.google.serviceAccountPath}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        const encryptedContent = encrypt(content);
        const fileName = path.basename(filePath);

        await prisma.serviceAccount.upsert({
          where: {
            clientId_fileName: {
              clientId: client.id,
              fileName: fileName
            }
          },
          update: {
            encryptedContent
          },
          create: {
            clientId: client.id,
            fileName: fileName,
            encryptedContent
          }
        });
        console.log(`Service Account encrypted and saved.`);
      } else {
        console.warn(`WARNING: Service Account file not found at ${filePath}`);
      }
    }
  }

  console.log('Migration completed successfully.');
}

migrate()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
