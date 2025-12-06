import { google } from 'googleapis';
import { clients } from '../config/clients';
import { z } from 'zod';

export const calendarCheckAvailability = async (args: { client_id: string; start_time?: string; end_time?: string; query_date?: string }) => {
  const { client_id, start_time, end_time, query_date } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: clientConfig.google.serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  // Determine the day to check
  let targetDate: Date;
  if (start_time) {
    targetDate = new Date(start_time);
  } else if (query_date) {
    targetDate = new Date(query_date);
  } else {
    targetDate = new Date(); // Default to today
  }

  // Set range for the full day (00:00 to 23:59)
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  try {
    // 1. Fetch ALL events for the day from ALL calendars
    const calendarPromises = clientConfig.google.availabilityCalendars.map(async (calId) => {
      try {
        const response = await calendar.events.list({
          calendarId: calId,
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });
        return response.data.items || [];
      } catch (err) {
        console.error(`Error fetching events from ${calId}:`, err);
        return []; // Continue even if one calendar fails
      }
    });

    const results = await Promise.all(calendarPromises);
    // Flatten and sort events by start time
    const events = results.flat().sort((a, b) => {
      const tA = new Date(a.start?.dateTime || 0).getTime();
      const tB = new Date(b.start?.dateTime || 0).getTime();
      return tA - tB;
    });
    
    // 2. Generate Day Summary (Free/Busy slots)
    // Simple logic: List busy times, everything else is free
    const busySlots = events.map(e => {
      const start = e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
      const end = e.end?.dateTime ? new Date(e.end.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
      return `${start} - ${end} (Ocupado)`;
    });

    const dayContext = busySlots.length > 0 
      ? `Agenda del día:\n${busySlots.join('\n')}` 
      : "Todo el día está libre.";

    // 3. Check Specific Slot (if requested)
    let isSpecificSlotAvailable = true;
    let conflictDetails = null;

    if (start_time && end_time) {
      const checkStart = new Date(start_time).getTime();
      const checkEnd = new Date(end_time).getTime();

      const conflict = events.find(e => {
        const eventStart = new Date(e.start?.dateTime || '').getTime();
        const eventEnd = new Date(e.end?.dateTime || '').getTime();
        return (checkStart < eventEnd && checkEnd > eventStart); // Overlap formula
      });

      if (conflict) {
        isSpecificSlotAvailable = false;
        conflictDetails = {
          start: conflict.start?.dateTime,
          end: conflict.end?.dateTime,
          summary: conflict.summary
        };
      }
    }

    // 4. Construct Response
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          available: isSpecificSlotAvailable,
          status: isSpecificSlotAvailable ? "Slot available" : "Slot busy",
          day_context: dayContext,
          conflict: conflictDetails
        })
      }]
    };

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
  const checkPromises = clientConfig.google.availabilityCalendars.map(async (calId) => {
    try {
      const response = await calendar.events.list({
        calendarId: calId,
        timeMin: start_time,
        timeMax: end_time,
        singleEvents: true,
      });
      return response.data.items || [];
    } catch (err) {
      console.error(`Error checking availability for ${calId} during booking:`, err);
      // Decide if we should block or continue. For now, we log and continue (treat as no events found on this failing calendar)
      return []; 
    }
  });

  const checkResults = await Promise.all(checkPromises);
  const conflictingEvents = checkResults.flat();

  if (conflictingEvents.length > 0) {
     return { content: [{ type: "text", text: JSON.stringify({ success: false, error: "Slot no longer available (Conflict detected)" }) }] };
  }

  try {
    const event = {
      summary: `Cita: ${patient_data.nombre} - ${patient_data.motivo}`,
      description: `Tel: ${patient_data.telefono}\nEmail: ${patient_data.email}`,
      start: { dateTime: start_time },
      end: { dateTime: end_time },
    };

    const response = await calendar.events.insert({
      calendarId: clientConfig.google.bookingCalendarId,
      requestBody: event,
    });

    // TODO: Trigger WhatsApp confirmation via Wassenger API (Optimization)

    return { content: [{ type: "text", text: JSON.stringify({ success: true, eventId: response.data.id }) }] };
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    throw new Error(`Failed to create appointment: ${error.message}`);
  }
};
