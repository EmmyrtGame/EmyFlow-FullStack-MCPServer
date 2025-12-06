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
}

export const clients: Record<string, ClientConfig> = {
  "white_dental": {
    google: {
      serviceAccountPath: "./creds/dental_bot_creds.json",
      availabilityCalendars: ["whitedental262@gmail.com", "dentalcareagenda321@gmail.com", "e1f1a4da8d0ff750657414b4e7699bdd946ab5c136fd86a49dd2dc5ef351495b@group.calendar.google.com"], // Add other calendars here if needed
      bookingCalendarId: "whitedental262@gmail.com"
    },
    meta: {
      pixelId: "123456789", // Placeholder
      accessToken: process.env.WHITE_DENTAL_META_TOKEN || ""
    },
    wassenger: {
      apiKey: process.env.WHITE_DENTAL_WASSENGER_TOKEN || "",
      deviceId: "68fd1067b488de07029fccc2"
    }
  },
  "test_dental": {
    google: {
      serviceAccountPath: "./creds/dental_bot_creds.json",
      availabilityCalendars: ["emmmyrtgame@gmail.com", "emmyrttutoriales@gmail.com"], // Add other calendars here if needed
      bookingCalendarId: "emmmyrtgame@gmail.com"
    },
    meta: {
      pixelId: "123456789", // Placeholder
      accessToken: process.env.WHITE_DENTAL_META_TOKEN || ""
    },
    wassenger: {
      apiKey: process.env.WHITE_DENTAL_WASSENGER_TOKEN || "",
      deviceId: "68fd1067b488de07029fccc2"
    }
  },
  // Add other clients here
};
