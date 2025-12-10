import { PrismaClient } from '@prisma/client';
import { decrypt } from '../admin/utils/crypto.util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const prisma = new PrismaClient();

// Interface matching the structure expected by the tools, similar to clients.ts
export interface DecryptedClientConfig {
  slug: string;
  name: string;
  isActive: boolean;
  timezone: string;
  
  google: {
    serviceAccountPath?: string;
    // Removed global calendars as per refactor
  };
  meta: {
    pixelId: string;
    accessToken: string;
  };
  wassenger: {
    apiKey: string;
    deviceId: string;
  };
  locations: Array<{
    name: string;
    address: string;
    mapUrl: string;
    google: {
      availabilityCalendars: string[];
      bookingCalendarId: string;
    };
  }>;
  reminderTemplates: Record<string, string>;
}

class ClientService {
  
  private configCache: Map<string, DecryptedClientConfig> = new Map();
  // We could implement cache expiration, but for now simple in-memory cache per process is okay.
  // Note: If configs change in DB, this cache needs invalidation. For v1, restarts or manual invalidation is assumed.

  async getClientConfig(slug: string): Promise<DecryptedClientConfig | null> {
    // Check cache first (optional, but good for performance)
    if (this.configCache.has(slug)) {
      return this.configCache.get(slug)!;
    }

    const client = await prisma.client.findUnique({
      where: { slug }
    });

    if (!client) return null;

    // Decrypt fields
    const meta = client.meta as any;
    if (meta.accessToken) {
      try {
        meta.accessToken = decrypt(meta.accessToken);
      } catch (e) {
        console.warn(`Failed to decrypt meta token for client ${slug}, assuming plain text or invalid.`);
      }
    }

    const wassenger = client.wassenger as any;
    if (wassenger.apiKey) {
      try {
        wassenger.apiKey = decrypt(wassenger.apiKey);
      } catch (e) {
        console.warn(`Failed to decrypt wassenger key for client ${slug}, assuming plain text or invalid.`);
      }
    }

    // Handle Service Account
    // We need to fetch the file content from ServiceAccount table
    const serviceAccountFile = await prisma.serviceAccount.findFirst({
      where: { clientId: client.id } // Assuming one per client for now or picking the first
    });

    let serviceAccountPath = '';
    
    if (serviceAccountFile) {
      try {
        const decryptedContent = decrypt(serviceAccountFile.encryptedContent);
        // Write to temp file
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `mcp_auth_${slug}_${serviceAccountFile.fileName}`);
        fs.writeFileSync(tempFilePath, decryptedContent);
        serviceAccountPath = tempFilePath;
      } catch (e) {
        console.error(`Failed to decrypt/write service account for client ${slug}`, e);
        // Fallback or error?
      }
    } else {
       // Fallback to what's in JSON if it exists and looks like a path (legacy migration case)
       // But we want to enforce DB usage. 
       const googleConfig = client.google as any;
       if (googleConfig.serviceAccountPath && fs.existsSync(googleConfig.serviceAccountPath)) {
          serviceAccountPath = googleConfig.serviceAccountPath;
       }
    }


    const config: DecryptedClientConfig = {
      slug: client.slug,
      name: client.name,
      isActive: client.isActive,
      timezone: client.timezone,
      google: {
        ...(client.google as any),
        serviceAccountPath: serviceAccountPath
      },
      meta: meta,
      wassenger: {
        apiKey: wassenger?.apiKey,
        deviceId: wassenger?.deviceId,
      },
      locations: client.locations ? (client.locations as any[]).map(loc => ({
        name: loc.name,
        address: loc.address,
        mapUrl: loc.mapUrl,
        google: loc.google
      })) : [],
      reminderTemplates: client.reminderTemplates as any
    };

    this.configCache.set(slug, config);
    return config;
  }

  async getClientByDeviceId(deviceId: string): Promise<DecryptedClientConfig | null> {
    // Inefficient scan for V1, but works with JSON columns in MySQL specific queries or in-memory
    // Since we can't easily query inside JSON in generic way without native JSON types support in Prisma schema for filter
    // (Prisma 5 + MySQL supports JSON filtering but we defined it as Json type in schema now, so we could try)
    // However, to keep it robust and since client count is low, let's fetch all active.
    
    // Attempt specific query if possible, otherwise list all.
    // Let's list all active clients and check.
    const clients = await prisma.client.findMany({
      where: { isActive: true }
    });

    for (const client of clients) {
      const wassenger = client.wassenger as any;
      if (wassenger && wassenger.deviceId === deviceId) {
        // reuse getClientConfig to handle decryption/cache
        return this.getClientConfig(client.slug);
      }
    }
    return null;
  }
}

export const clientService = new ClientService();
