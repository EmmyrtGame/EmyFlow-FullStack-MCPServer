import { crmHandoffHuman } from './src/tools/crm';
import dotenv from 'dotenv';

dotenv.config();

const testCrmHandoff = async () => {
    console.log('--- TEST: CRM Handoff to Human ---');
    console.log('Client: white_dental');
    console.log('Phone: +5213122983813');

    try {
        const result = await crmHandoffHuman({
            client_id: 'white_dental',
            phone_number: '+5213122983813'
        });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error('Test Failed:', error.message);
    }
};

testCrmHandoff();
