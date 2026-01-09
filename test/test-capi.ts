/**
 * Test script for CAPI Schedule Event with enhanced user data.
 * Run with: npx ts-node test/test-capi.ts
 */
import { trackScheduleEvent } from '../src/tools/marketing';

async function testCapiScheduleEvent() {
  console.log('Testing CAPI Schedule Event with enhanced user data...\n');

  const result = await trackScheduleEvent({
    client_id: 'white_dental', // Real client from DB
    user_data: {
      phone: '+5218181234567',
      firstName: 'María',
      lastName: 'García López',
      email: 'maria.garcia@example.com',
      country: 'mx'
    },
    test_event_code: 'TEST65570'
  });

  console.log('\nResult:', result);
}

testCapiScheduleEvent().catch(console.error);
