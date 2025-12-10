import axios from 'axios';
import { clientService } from '../services/client.service';

const WASSENGER_API_URL = 'https://api.wassenger.com/v1/messages';

/**
 * Sends a scheduled message using Wassenger API.
 */
export const scheduleWassengerMessage = async (
  apiKey: string,
  deviceId: string,
  phone: string,
  message: string,
  deliverAt: string
) => {
  try {
    const response = await axios.post(
      WASSENGER_API_URL,
      {
        phone,
        message,
        deliverAt,
        device: deviceId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Token': apiKey
        }
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error scheduling Wassenger message:', error.response?.data || error.message);
    // Don't throw, just log error to avoid breaking the appointment flow
    return null;
  }
};

/**
 * Schedules reminders for an appointment (24h, 6h, 3h before).
 */
export const scheduleAppointmentReminders = async (
  client_id: string,
  phone: string,
  appointmentTimeStr: string,
  patientName: string,
  locationConfig?: any // Optional location config override
) => {
  const clientConfig = await clientService.getClientConfig(client_id);
  if (!clientConfig || !clientConfig.reminderTemplates) {
    console.warn(`Client ${client_id} missing config or reminderTemplates`);
    return;
  }

  // Use provided locationConfig or fall back to first location
  // Note: Global 'location' is removed, so we fallback to locations[0]
  const activeLocation = locationConfig || (clientConfig.locations && clientConfig.locations.length > 0 ? clientConfig.locations[0] : null);

  const appointmentTime = new Date(appointmentTimeStr);
  const now = new Date();

  const timeFormatted = appointmentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const dayOfWeek = appointmentTime.toLocaleDateString('es-MX', { weekday: 'long' });
  // Capitalize first letter of day
  const dayOfWeekCapitalized = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
  
  const dayNum = appointmentTime.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

  const reminders = [
    { label: '24h', details: { hours: 24 } },
    { label: '3h', details: { hours: 3 } },
    { label: '1h', details: { hours: 1 } },
  ];

  for (const reminder of reminders) {
    const template = clientConfig.reminderTemplates[reminder.label as keyof typeof clientConfig.reminderTemplates];
    if (!template) continue;

    const reminderTime = new Date(appointmentTime);
    reminderTime.setHours(reminderTime.getHours() - reminder.details.hours);
    
    if (reminderTime > now) {
      let message = template
        .replace(/{{patient_name}}/g, patientName)
        .replace(/{{time}}/g, timeFormatted)
        .replace(/{{day_of_week}}/g, dayOfWeekCapitalized)
        .replace(/{{day_num}}/g, dayNum);

      if (activeLocation) {
        message = message
            .replace(/{{location_address}}/g, activeLocation.address)
            .replace(/{{location_map_url}}/g, activeLocation.mapUrl);
      }

      // Fallback for old templates if any exist or if user reverts
      message = message.replace(/{name}/g, patientName).replace(/{time}/g, timeFormatted);


      try {
        await scheduleWassengerMessage(
            clientConfig.wassenger.apiKey, 
            clientConfig.wassenger.deviceId, 
            phone, 
            message, 
            reminderTime.toISOString()
        );
        console.log(`Scheduled ${reminder.label} reminder for ${phone} at ${reminderTime.toISOString()}`);
      } catch (e) {
        console.error(`Failed to schedule ${reminder.label} reminder`, e);
      }
    }
  }
};
