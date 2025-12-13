import { z } from 'zod';

export const clientSchema = z.object({
  slug: z.string().min(3, 'Slug must be at least 3 characters').regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().default(true),
  webhookUrl: z.string().url('Must be a valid URL').min(1, 'Webhook URL is required'),
  timezone: z.string().default('America/Mexico_City'),

  google: z.object({
    serviceAccountPath: z.string().optional(),
  }),
  
  meta: z.object({
    pixelId: z.string().regex(/^\d+$/, 'Pixel ID must be numeric').optional().or(z.literal('')),
    accessToken: z.string().optional(),
  }),
  
  wassenger: z.object({
    apiKey: z.string().optional(),
    deviceId: z.string().min(1, 'Device ID is required'),
  }),
  
  locations: z.array(z.object({
    name: z.string().min(2, 'Name must be at least 2 chars (e.g. "center_1")'),
    address: z.string().min(1, 'Address is required'),
    phone: z.string().optional(),
    mapUrl: z.string().url('Must be a valid URL'),
    google: z.object({
        bookingCalendarId: z.string().min(1, 'Booking Calendar ID is required'),
        availabilityCalendars: z.string().min(1, 'One or more Calendar IDs required').or(z.array(z.string()).min(1)) 
    })
  })).min(1, 'At least one location is required'),
  
  reminderTemplates: z.object({
    "24h": z.string().min(1, '24h template is required'),
    "3h": z.string().min(1, '3h template is required'),
    "1h": z.string().min(1, '1h template is required'),
  }),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const defaultValues: ClientFormValues = {
  slug: '',
  name: '',
  isActive: true,
  webhookUrl: '',
  timezone: 'America/Mexico_City',
  google: {
    serviceAccountPath: '',
  },
  meta: {
    pixelId: '',
    accessToken: '',
  },
  wassenger: {
    apiKey: '',
    deviceId: '',
  },
  locations: [{
     name: 'main',
     address: '',
     mapUrl: '',
     google: {
         bookingCalendarId: '',
         availabilityCalendars: []
     }
  }],
  reminderTemplates: {
    "24h": "Hola {{patient_name}}, recuerda tu cita mañana a las {{time}}.",
    "3h": "Hola {{patient_name}}, tu cita es hoy a las {{time}}.",
    "1h": "Hola {{patient_name}}, te esperamos en 1 hora.",
  }
};
