import { z } from 'zod';

// Client Config Schemas
export const ConfigSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9_]+$/, 'Slug must be alphanumeric with underscores'),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  webhookUrl: z.string().url('Must be a valid URL'),
  timezone: z.string().default('America/Mexico_City'),
  
  meta: z.object({
    pixelId: z.string().regex(/^\d+$/).optional().or(z.literal('')),
    accessToken: z.string().optional()
  }).optional(),
  
  wassenger: z.object({
    apiKey: z.string().optional(),
    deviceId: z.string().optional()
  }).optional(),
  
  locations: z.array(z.object({
    name: z.string(), // Acts as 'sede' identifier
    address: z.string(),
    phone: z.string().optional(),
    mapUrl: z.string(),
    google: z.object({
      bookingCalendarId: z.string(),
      availabilityCalendars: z.array(z.string())
    })
  })).min(1, "At least one location is required"),
  
  reminderTemplates: z.record(z.string(), z.string()).optional().default({})
});

// Admin User Schema
export const UserSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters")
});

export type ClientConfigInput = z.infer<typeof ConfigSchema>;
export type UserInput = z.infer<typeof UserSchema>;
