import { z } from 'zod';

export const ConfigSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9_]+$/, 'Slug must be alphanumeric with underscores'),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  timezone: z.string().default('America/Mexico_City'),
  availabilityStrategy: z.enum(['GLOBAL', 'PER_LOCATION']).default('PER_LOCATION'),
  
  google: z.object({
    serviceAccountPath: z.string().optional(), // Handled by file upload, but we store path string from DB
  }),
  
  meta: z.object({
    pixelId: z.string().regex(/^\d+$/).optional(),
    accessToken: z.string()
  }),
  
  wassenger: z.object({
    apiKey: z.string(),
    deviceId: z.string()
  }),
  
  locations: z.array(z.object({
    name: z.string(), // Acts as 'sede' identifier
    address: z.string(),
    mapUrl: z.string(),
    google: z.object({
      bookingCalendarId: z.string(),
      availabilityCalendars: z.array(z.string())
    })
  })).min(1),
  
  reminderTemplates: z.record(z.string(), z.string()).optional()
});

export type ClientConfigInput = z.infer<typeof ConfigSchema>;
