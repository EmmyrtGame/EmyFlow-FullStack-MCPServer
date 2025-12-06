import { calendarCheckAvailability, calendarCreateAppointment } from './src/tools/calendar';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = 'test_dental';
const TEST_DATE = new Date();
TEST_DATE.setDate(TEST_DATE.getDate() + 1); // Tomorrow
const TEST_DATE_STR = TEST_DATE.toISOString().split('T')[0];

const runTest = async () => {
    console.log(`--- Starting Test for Client: ${CLIENT_ID} on ${TEST_DATE_STR} ---`);

    // 1. Check Availability
    console.log('\n--- Step 1: Checking Availability ---');
    let availability;
    try {
        availability = await calendarCheckAvailability({
            client_id: CLIENT_ID,
            query_date: TEST_DATE_STR
        });
        const content = JSON.parse(availability.content[0].text);
        console.log('Day Context:', content.day_context);
    } catch (error: any) {
        console.error('Failed to check availability:', error.message);
        return;
    }

    // 2. Attempt Booking (Conflict Scenario)
    // We will try to book a slot that is likely to be busy if there are any busy slots
    // If "Todo el día está libre", we skip this strict conflict test or try to book the same slot twice.
    console.log('\n--- Step 2: Attempting Conflict Booking (Double Booking Test) ---');
    
    // Let's create a booking first at a specific time, then try to create ANOTHER one at the same time.
    const startConf = new Date(TEST_DATE); startConf.setHours(14, 0, 0, 0);
    const endConf = new Date(TEST_DATE); endConf.setHours(15, 0, 0, 0);

    console.log(`Trying to create First Appointment at ${startConf.toLocaleTimeString()}`);
    try {
        const res1 = await calendarCreateAppointment({
            client_id: CLIENT_ID,
            patient_data: { nombre: 'Test User 1', telefono: '0000000000', email: 'test1@example.com', motivo: 'Test Booking 1' },
            start_time: startConf.toISOString(),
            end_time: endConf.toISOString()
        });
        const json1 = JSON.parse(res1.content[0].text);
        console.log('Booking 1 Result:', json1);

        if (json1.success) {
            console.log('Booking 1 verified. Now attempting to DOUBLE BOOK this slot...');
            const res2 = await calendarCreateAppointment({
                client_id: CLIENT_ID,
                patient_data: { nombre: 'Test User 2', telefono: '0000000000', email: 'test2@example.com', motivo: 'Test Booking 2 (Should Fail)' },
                start_time: startConf.toISOString(),
                end_time: endConf.toISOString()
            });
            const json2 = JSON.parse(res2.content[0].text);
            console.log('Booking 2 Result:', json2);
            
            if (json2.success === false) {
                console.log('PASSED: Double booking prevented.');
            } else {
                console.error('FAILED: Double booking was ALLOWED!');
            }
        } else {
            console.log('Could not perform double booking test because first booking failed likely due to existing real event.');
        }

    } catch (error: any) {
         console.error('Error during conflict test:', error.message);
    }
};

runTest();
