import { google } from 'googleapis';
import { clients } from '../config/clients';
import { z } from 'zod';

export const calendarCheckAvailability = async (args: { client_id: string; start_time: string; end_time: string }) => {
  const { client_id, start_time, end_time } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: clientConfig.google.serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const response = await calendar.events.list({
      calendarId: clientConfig.google.calendarId,
      timeMin: start_time,
      timeMax: end_time,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const isAvailable = events.length === 0;

    if (isAvailable) {
      return { content: [{ type: "text", text: JSON.stringify({ available: true }) }] };
    } else {
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            available: false, 
            conflicts: events.map(e => ({ start: e.start?.dateTime, end: e.end?.dateTime })) 
          }) 
        }] 
      };
    }
  } catch (error: any) {
    console.error('Error checking availability:', error);
    throw new Error(`Failed to check availability: ${error.message}`);
  }
};

export const calendarCreateAppointment = async (args: { 
  client_id: string; 
  patient_data: { nombre: string; telefono: string; email: string; motivo: string };
  start_time: string; 
  end_time: string;
}) => {
  const { client_id, patient_data, start_time, end_time } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: clientConfig.google.serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  // Double check availability
  const availabilityCheck = await calendar.events.list({
    calendarId: clientConfig.google.calendarId,
    timeMin: start_time,
    timeMax: end_time,
    singleEvents: true,
  });

  if (availabilityCheck.data.items && availabilityCheck.data.items.length > 0) {
     return { content: [{ type: "text", text: JSON.stringify({ success: false, error: "Slot no longer available" }) }] };
  }

  try {
    const event = {
      summary: `Cita: ${patient_data.nombre} - ${patient_data.motivo}`,
      description: `Tel: ${patient_data.telefono}\nEmail: ${patient_data.email}`,
      start: { dateTime: start_time },
      end: { dateTime: end_time },
    };

    const response = await calendar.events.insert({
      calendarId: clientConfig.google.calendarId,
      requestBody: event,
    });

    // TODO: Trigger WhatsApp confirmation via Wassenger API (Optimization)

    return { content: [{ type: "text", text: JSON.stringify({ success: true, eventId: response.data.id }) }] };
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    throw new Error(`Failed to create appointment: ${error.message}`);
  }
};
