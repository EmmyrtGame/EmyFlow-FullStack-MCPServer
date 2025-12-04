import dotenv from 'dotenv';
dotenv.config();

export interface ClientConfig {
  google: {
    serviceAccountPath: string;
    calendarId: string;
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
      serviceAccountPath: "./creds/white_dental_gcal.json",
      calendarId: "whitedental262@gmail.com"
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
