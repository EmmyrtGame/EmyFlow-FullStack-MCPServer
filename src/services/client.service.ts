import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import { decrypt } from '../admin/utils/crypto.util';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Interface matching the structure expected by the tools, similar to clients.ts
export interface DecryptedClientConfig {
  slug: string;
  name: string;
  isActive: boolean;
  webhookUrl?: string;
  timezone: string;
  
  google: {
    serviceAccountPath?: string;
    credentials?: any; // Encrypted JSON content
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
    phone?: string;
  }>;
  reminderTemplates: Record<string, string>;
}

class ClientService {
  
  private configCache: Map<string, DecryptedClientConfig> = new Map();

  async getClientConfig(slug: string): Promise<DecryptedClientConfig | null> {
    // Check cache first
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
        console.warn(`Failed to decrypt meta token for client ${slug}, assuming plain text.`);
      }
    }

    const wassenger = client.wassenger as any;
    if (wassenger.apiKey) {
      try {
        wassenger.apiKey = decrypt(wassenger.apiKey);
      } catch (e) {
        // console.warn(`Failed to decrypt wassenger key...`);
      }
    }

    // Handle Service Account
    let credentials = null;

    if (client.serviceAccountId) {
       const sa = await prisma.serviceAccount.findUnique({ where: { id: client.serviceAccountId } });
       if (sa) {
          try {
             const decryptedJson = decrypt(sa.encryptedContent);
             credentials = JSON.parse(decryptedJson);
          } catch (e) {
             console.error(`Failed to decrypt Service Account ${sa.id} for client ${slug}`, e);
          }
       }
    }


    // Construct Google Config from ServiceAccount relation
    
    const config: DecryptedClientConfig = {
      slug: client.slug,
      name: client.name,
      isActive: client.isActive,
      webhookUrl: client.webhookUrl ?? undefined,
      timezone: client.timezone,
      google: {
        credentials: credentials
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
        google: loc.google,
        phone: (loc as any).phone
      })) : [],
      reminderTemplates: client.reminderTemplates as any
    };

    this.configCache.set(slug, config);
    return config;
  }

  async getClientByDeviceId(deviceId: string): Promise<DecryptedClientConfig | null> {
    // Optimized O(1) lookup using the unique wassengerDeviceId column
    const client = await prisma.client.findUnique({
      where: { 
        wassengerDeviceId: deviceId
      }
    });

    if (client && client.isActive) {
        // reuse getClientConfig to handle decryption/cache
        return this.getClientConfig(client.slug);
    }
    
    return null;
  }
}

export const clientService = new ClientService();
