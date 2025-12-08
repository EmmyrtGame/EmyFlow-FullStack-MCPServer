import { google } from 'googleapis';
import { clients } from '../config/clients';
import { z } from 'zod';
import { scheduleAppointmentReminders } from './wassenger';
import { trackScheduleEvent } from './marketing';

/**
 * Checks appointment availability in Google Calendar.
 * @param args.client_id The client identifier.
 * @param args.start_time Optional start time to check specific slot.
 * @param args.end_time Optional end time to check specific slot.
 * @param args.query_date Optional date to check full day availability.
 */
// Helper to parse "DD.MM.YYYY HH:mm" or "DD.MM.YYYY" or standard ISO
const parseInputDate = (dateStr: string): Date => {
  // Check for DD.MM.YYYY format
  const dmYMatch = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (dmYMatch) {
    const day = parseInt(dmYMatch[1], 10);
    const month = parseInt(dmYMatch[2], 10) - 1; // Months are 0-indexed
    const year = parseInt(dmYMatch[3], 10);
    const hour = dmYMatch[4] ? parseInt(dmYMatch[4], 10) : 0;
    const minute = dmYMatch[5] ? parseInt(dmYMatch[5], 10) : 0;
    return new Date(year, month, day, hour, minute);
  }
  
  // Check for YYYY-MM-DD format (treat as local to avoid UTC shift)
  const yMDMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yMDMatch) {
    const year = parseInt(yMDMatch[1], 10);
    const month = parseInt(yMDMatch[2], 10) - 1;
    const day = parseInt(yMDMatch[3], 10);
    return new Date(year, month, day);
  }

  return new Date(dateStr);
};

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

  let targetDate: Date;
  if (start_time) {
    targetDate = parseInputDate(start_time);
  } else if (query_date) {
    targetDate = parseInputDate(query_date);
  } else {
    targetDate = new Date(); // Default to today
  }

  // Calculate time range in UTC that covers the entire day in the target timezone
  // We widen the search window (e.g. -24h to +24h from UTC midnight) to ensure we capture
  // the full local day regardless of timezone offset. We will filter later.
  const searchStart = new Date(targetDate);
  searchStart.setHours(0, 0, 0, 0);
  searchStart.setDate(searchStart.getDate() - 1); // Previous day
  
  const searchEnd = new Date(targetDate);
  searchEnd.setHours(23, 59, 59, 999);
  searchEnd.setDate(searchEnd.getDate() + 1); // Next day

  try {
    const calendarPromises = clientConfig.google.availabilityCalendars.map(async (calId) => {
      try {
        const response = await calendar.events.list({
          calendarId: calId,
          timeMin: searchStart.toISOString(),
          timeMax: searchEnd.toISOString(),
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
    const allEvents = results.flat();

    // Filter events to only those that fall within the target day in the client's timezone
    // FIXED: Use targetDate calculated above instead of falling back to new Date() if query_date is missing
    const targetDateString = targetDate.toLocaleDateString('en-CA', { timeZone: clientConfig.timezone }); // YYYY-MM-DD
    
    const events = allEvents.filter(e => {
      if (!e.start?.dateTime) return false;
      const eventDateInZone = new Date(e.start.dateTime).toLocaleDateString('en-CA', { timeZone: clientConfig.timezone });
      return eventDateInZone === targetDateString;
    }).sort((a, b) => {
      const tA = new Date(a.start?.dateTime || 0).getTime();
      const tB = new Date(b.start?.dateTime || 0).getTime();
      return tA - tB;
    });
    
    const busySlots = events.map(e => {
      const start = e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: clientConfig.timezone }) : 'N/A';
      const end = e.end?.dateTime ? new Date(e.end.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: clientConfig.timezone }) : 'N/A';
      return `${start} - ${end} (Ocupado)`;
    });

    const dayContext = busySlots.length > 0 
      ? `Agenda del día:\n${busySlots.join('\n')}` 
      : "Todo el día está libre.";

    // 3. Check Specific Slot (if requested)
    let isSpecificSlotAvailable = true;
    let conflictDetails = null;

    if (start_time && end_time) {
      const checkStart = parseInputDate(start_time).getTime();
      const checkEnd = parseInputDate(end_time).getTime();

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

/**
 * Creates an appointment in Google Calendar.
 * @param args.client_id The client identifier.
 * @param args.patient_data Patient details (name, phone).
 * @param args.start_time Start time of the appointment.
 * @param args.end_time End time of the appointment.
 */
export const calendarCreateAppointment = async (args: { 
  client_id: string; 
  patient_data: { nombre: string; telefono: string };
  start_time: string; 
  end_time: string;
  description: string;
}) => {
  const { client_id, patient_data, start_time, end_time, description } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: clientConfig.google.serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });


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
      summary: `Evaluación Dental: ${patient_data.nombre}`,
      description: description,
      start: { dateTime: start_time },
      end: { dateTime: end_time },
    };

    const response = await calendar.events.insert({
      calendarId: clientConfig.google.bookingCalendarId,
      requestBody: event,
    });


    await scheduleAppointmentReminders(
      client_id, 
      patient_data.telefono, 
      start_time, 
      patient_data.nombre
    );


    trackScheduleEvent({
      client_id,
      user_data: {
        phone: patient_data.telefono
      }
    });

    return { content: [{ type: "text", text: JSON.stringify({ success: true, eventId: response.data.id }) }] };
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    throw new Error(`Failed to create appointment: ${error.message}`);
  }
};
