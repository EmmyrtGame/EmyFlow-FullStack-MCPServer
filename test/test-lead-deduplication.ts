/**
 * Test: Lead Deduplication
 * 
 * Simulates the race condition scenario where multiple Wassenger webhooks
 * arrive rapidly before metadata propagates. Verifies that only ONE lead
 * event is sent to Meta CAPI.
 * 
 * Run: npx ts-node test/test-lead-deduplication.ts
 */

import axios from 'axios';

const API_URL = 'http://localhost:3000';
const TARGET_CLIENT_SLUG = 'white_dental';

// Simulated Wassenger webhook payload (based on real structure)
const createWebhookPayload = (deviceId: string, phoneNumber: string, isFirstMessage: boolean, hasLeadMetadata: boolean) => ({
    event: 'message:in:new',
    device: {
        id: deviceId
    },
    data: {
        fromNumber: phoneNumber,
        from: `${phoneNumber}@c.us`,
        body: 'Hola, me interesa información sobre ortodoncia',
        flow: 'inbound',
        meta: {
            isFirstMessage: isFirstMessage
        },
        chat: {
            contact: {
                metadata: hasLeadMetadata ? [{ key: 'capi_lead_enviado', value: 'true' }] : []
            },
            labels: []
        }
    }
});

async function getClientDeviceId(slug: string): Promise<string> {
    // Login first
    const loginRes = await axios.post(`${API_URL}/api/admin/auth/login`, {
        username: 'admin',
        password: 'TempPassword123!'
    });
    const token = loginRes.data.token;

    // Get clients
    const clientsRes = await axios.get(`${API_URL}/api/admin/clients`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const client = clientsRes.data.find((c: any) => c.slug === slug);
    if (!client) {
        throw new Error(`Client ${slug} not found`);
    }

    // Parse wassenger config to get deviceId
    const wassengerConfig = typeof client.wassenger === 'string'
        ? JSON.parse(client.wassenger)
        : client.wassenger;

    return wassengerConfig.deviceId || client.wassengerDeviceId;
}

async function testLeadDeduplication() {
    const testPhone = `521555${Date.now().toString().slice(-7)}`; // Unique phone for each test run
    const deviceId = '68fd1067b488de07029fccc2'; // white_dental deviceId

    console.log('='.repeat(60));
    console.log('🧪 TEST: Lead Deduplication');
    console.log('='.repeat(60));
    console.log(`\nUsing deviceId: ${deviceId}`);
    console.log(`Using test phone: ${testPhone}`);
    console.log('');

    // Scenario 1: First message (should trigger NEW_CONVERSATION, NOT LEAD)
    console.log('📨 Sending Message 1 (isFirstMessage: true)...');
    try {
        const res1 = await axios.post(`${API_URL}/webhooks/whatsapp`,
            createWebhookPayload(deviceId, testPhone, true, false)
        );
        console.log(`   Response: ${res1.data}`);
    } catch (err: any) {
        console.log(`   Error: ${err.response?.data || err.message}`);
    }

    // Small delay to simulate realistic timing (but still faster than metadata propagation)
    await new Promise(r => setTimeout(r, 100));

    // Scenario 2: Second message (should trigger LEAD - this is the first eligible one)
    console.log('📨 Sending Message 2 (isFirstMessage: false, no lead metadata)...');
    try {
        const res2 = await axios.post(`${API_URL}/webhooks/whatsapp`,
            createWebhookPayload(deviceId, testPhone, false, false)
        );
        console.log(`   Response: ${res2.data}`);
    } catch (err: any) {
        console.log(`   Error: ${err.response?.data || err.message}`);
    }

    // Very quick messages simulating race condition
    console.log('📨 Sending Messages 3-6 RAPIDLY (simulating race condition)...');
    const rapidPromises = [3, 4, 5, 6].map(async (n) => {
        try {
            // All these arrive WITHOUT lead metadata (Wassenger hasn't propagated it yet)
            const res = await axios.post(`${API_URL}/webhooks/whatsapp`,
                createWebhookPayload(deviceId, testPhone, false, false)
            );
            console.log(`   Message ${n} Response: ${res.data}`);
        } catch (err: any) {
            console.log(`   Message ${n} Error: ${err.response?.data || err.message}`);
        }
    });

    await Promise.all(rapidPromises);

    // Wait a moment then send another message (still no metadata from Wassenger)
    await new Promise(r => setTimeout(r, 500));

    console.log('📨 Sending Message 7 (500ms later, still no lead metadata)...');
    try {
        const res7 = await axios.post(`${API_URL}/webhooks/whatsapp`,
            createWebhookPayload(deviceId, testPhone, false, false)
        );
        console.log(`   Response: ${res7.data}`);
    } catch (err: any) {
        console.log(`   Error: ${err.response?.data || err.message}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('');
    console.log('📊 Check server logs for:');
    console.log('   - ONE "[Webhook] Detected potential Lead for client..."');
    console.log('   - MULTIPLE "[Webhook] Lead event skipped ... already in deduplication cache"');
    console.log('');
    console.log('If you see multiple "Detected potential Lead" for the same phone,');
    console.log('the deduplication is NOT working correctly.');
}

testLeadDeduplication().catch(console.error);
