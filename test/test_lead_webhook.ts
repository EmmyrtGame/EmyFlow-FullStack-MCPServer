
import axios from 'axios';

const WEBHOOK_URL = 'http://localhost:3000/webhooks/whatsapp';
const DEVICE_ID = '68fd1067b488de07029fccc2'; // white_dental

const runTest = async () => {
  console.log('--- Testing Lead Webhook Trigger (Metadata Deduplication) ---');

  // Scenario 1: No metadata (Should Track)
  const payload1 = {
    device: { id: DEVICE_ID },
    data: {
      fromNumber: '+5215551234567',
      body: 'Info please',
      flow: 'inbound',
      meta: { isFirstMessage: false },
      chat: { 
        contact: {
            metadata: [] // No capi_lead_enviado
        }
      }
    }
  };

  // Scenario 2: 'capi_lead_enviado' metadata is true (Should SKIP)
  const payload2 = {
    device: { id: DEVICE_ID },
    data: {
      fromNumber: '+5215551234567',
      body: 'More info',
      flow: 'inbound',
      meta: { isFirstMessage: false },
      chat: { 
        contact: {
            metadata: [
                { key: 'capi_lead_enviado', value: 'true' }
            ]
        }
      }
    }
  };

  try {
    console.log('\n[Test 1] Sending payload WITHOUT label...');
    await axios.post(WEBHOOK_URL, payload1);
    console.log('Test 1 sent. Check server logs for "Detected potential Lead".');
    
    // Slight delay to separate logs
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n[Test 2] Sending payload WITH label...');
    await axios.post(WEBHOOK_URL, payload2);
    console.log('Test 2 sent. Check server logs for "Lead event skipped".');

  } catch (error: any) {
    console.error('Test Failed:', error.message);
    if (error.response) {
       console.error('Server Responded:', error.response.data);
    }
  }
};

runTest();
