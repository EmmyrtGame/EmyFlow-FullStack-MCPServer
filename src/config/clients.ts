import dotenv from 'dotenv';
dotenv.config();

export interface ClientConfig {
  google: {
    serviceAccountPath: string;
    availabilityCalendars: string[];
    bookingCalendarId: string;
  };
  meta: {
    pixelId: string;
    accessToken: string;
  };
  wassenger: {
    apiKey: string;
    deviceId: string;
  };
  location: { // Este se toma por default si no se especifica una sede o si no se registra más de una, se mantiene por compatibilidad
    address: string;
    mapUrl: string;
  };
  /**
   * Strategy for checking availability:
   * - 'GLOBAL': Checks availability across ALL calendars defined in the top-level 'google.availabilityCalendars'.
   *             Use this if resources (doctors) are shared between locations.
   * - 'PER_LOCATION': Checks availability ONLY on the specific location's calendars.
   *                   Use this if each location has independent staff/resources.
   * Default is 'PER_LOCATION' if not specified.
   */
  availabilityStrategy?: 'GLOBAL' | 'PER_LOCATION';
  locations?: Record<string, {
    name: string;
    google: {
      availabilityCalendars: string[];
      bookingCalendarId: string;
    };
    location: {
      address: string;
      mapUrl: string;
    };
  }>;
  reminderTemplates: {
    "24h": string;
    "3h": string;
    "1h": string;
  };
  timezone: string;
}

export const clients: Record<string, ClientConfig> = {
  "white_dental": {
    availabilityStrategy: "GLOBAL",
    google: {
      serviceAccountPath: "./creds/dental_bot_creds.json",
      availabilityCalendars: ["whitedental262@gmail.com", "dentalcareagenda321@gmail.com", "e1f1a4da8d0ff750657414b4e7699bdd946ab5c136fd86a49dd2dc5ef351495b@group.calendar.google.com"], // Add other calendars here if needed
      bookingCalendarId: "whitedental262@gmail.com"
    },
    timezone: "America/Mexico_City",
    meta: {
      pixelId: "836238362237559", // Placeholder
      accessToken: process.env.WHITE_DENTAL_META_TOKEN || ""
    },
    wassenger: {
      apiKey: process.env.WHITE_DENTAL_WASSENGER_TOKEN || "",
      deviceId: "68fd1067b488de07029fccc2"
    },
    location: {
      address: "Federal México-Pachuca 550, San Francisco Cuautliquixca, 55760 Ojo de Agua, Méx.",
      mapUrl: "https://maps.app.goo.gl/9NoJdWGcqQhDDRbRA"
    },
    locations: {
      "san_francisco": {
        name: "San Francisco Cuautliquixca",
        google: {
          availabilityCalendars: ["whitedental262@gmail.com", "dentalcareagenda321@gmail.com", "e1f1a4da8d0ff750657414b4e7699bdd946ab5c136fd86a49dd2dc5ef351495b@group.calendar.google.com"],
          bookingCalendarId: "whitedental262@gmail.com"
        },
        location: {
          address: "Federal México-Pachuca 550, San Francisco Cuautliquixca, 55760 Ojo de Agua, Méx.",
          mapUrl: "https://maps.app.goo.gl/9NoJdWGcqQhDDRbRA"
        }
      }
    },
    reminderTemplates: {
      "24h": "¡Hola {{patient_name}}! 👋\n\nEn White Dental ya estamos preparando todo el material y el consultorio para tu visita de mañana {{day_of_week}} {{day_num}} a las {{time}}.\n\nPor favor, ayúdanos a confirmar tu asistencia para tener todo listo a tu llegada 🦷.\n\n📍{{location_address}}\n\n(Si ya reprogramaste tu cita, haz caso omiso a los recordatorios, si no, por favor confirma).\n\n¿Podemos contar con tu asistencia?",
      "3h": "¡Hola {{patient_name}}! ☀️\n\nTu espacio está reservado y nuestro equipo está listo para recibirte hoy a las {{time}}.\n\nTe recomendamos llegar 10 minutos antes para pasar directo.\n\n📞 Si tuviste un imprevisto de última hora, avísanos al 56 4557 0796 para notificar al doctor.\n\n(Si ya cancelaste, omite este mensaje).",
      "1h": "{{patient_name}}, te esperamos en 1 hora ⏰\n\nTodo está listo para tu atención a las {{time}}.\n\n📍 Ubicación: {{location_map_url}}\n\nCualquier duda en el camino, llámanos. ¡Viaja con cuidado!"
    }
  },

  // Add other clients here
};
