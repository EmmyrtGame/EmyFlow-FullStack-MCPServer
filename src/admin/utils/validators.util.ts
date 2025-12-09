import { z } from 'zod';

export const ConfigSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9_]+$/, 'Slug must be alphanumeric with underscores'),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  timezone: z.string().default('America/Mexico_City'),
  availabilityStrategy: z.enum(['GLOBAL', 'PER_LOCATION']).default('PER_LOCATION'),
  
  google: z.object({
    serviceAccountPath: z.string().optional(), // Now managed via file upload, but path might be stored for reference or legacy
    availabilityCalendars: z.array(z.string()).default([]),
    bookingCalendarId: z.string().optional()
  }),
  
  meta: z.object({
    pixelId: z.string().optional(),
    accessToken: z.string().optional()
  }),
  
  wassenger: z.object({
    apiKey: z.string().optional(),
    deviceId: z.string().optional()
  }),
  
  location: z.object({
    address: z.string().optional(),
    mapUrl: z.string().url().optional().or(z.literal(''))
  }),
  
  locations: z.array(z.object({
    name: z.string(),
    calendars: z.array(z.string()),
    address: z.string(),
    mapUrl: z.string()
  })).optional(),
  
  reminderTemplates: z.record(z.string(), z.string()).optional()
});

export type ClientConfigInput = z.infer<typeof ConfigSchema>;
