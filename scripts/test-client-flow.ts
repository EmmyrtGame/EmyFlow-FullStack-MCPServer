import axios from 'axios';

const API_URL = 'http://localhost:3000/api/admin';

async function main() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'TempPassword123!'
    });
    const token = loginRes.data.token;
    console.log('Login successful. Token obtained.');

    // 2. Create Client payload (simulating Frontend)
    const clientPayload = {
      name: "Test Dental Clinic",
      slug: `test_clinic_${Date.now()}`, // Unique slug
      timezone: "America/Mexico_City",
      isActive: true,
      availabilityStrategy: "PER_LOCATION",
      google: {
        serviceAccountPath: "path/to/virtual/file.json"
      },
      meta: {
        pixelId: "1234567890",
        accessToken: "EAAB_FAKE_TOKEN"
      },
      wassenger: {
        apiKey: "fake_wassenger_key",
        deviceId: "device_123"
      },
      // Frontend sends 'locations' array, but NOT 'location' object
      locations: [
        {
          name: "sede_norte",
          address: "123 North St",
          mapUrl: "http://maps.google.com/?q=north",
          google: {
            bookingCalendarId: "booking_north@group.calendar.google.com",
            availabilityCalendars: ["avail_north@group.calendar.google.com"]
          }
        },
        {
          name: "sede_sur",
          address: "456 South St",
          mapUrl: "http://maps.google.com/?q=south",
          google: {
            bookingCalendarId: "booking_south@group.calendar.google.com",
            availabilityCalendars: ["avail_south@group.calendar.google.com"]
          }
        }
      ],
      reminderTemplates: {
        "24h": "Reminder 24h",
        "3h": "Reminder 3h",
        "1h": "Reminder 1h"
      }
    };

    console.log('Creating client with payload:', JSON.stringify(clientPayload, null, 2));

    // 3. Send POST request
    const createRes = await axios.post(`${API_URL}/clients`, clientPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Client created successfully!');
    console.log('Response:', createRes.data);

    // Verify 'location' field was auto-populated logic side (though it's in DB)
    if (createRes.data.location && createRes.data.location.name === 'sede_norte') {
      console.log('SUCCESS: Legacy location field populated correctly from first sede.');
    } else {
      console.warn('WARNING: Legacy location field might be missing or incorrect.');
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();
