import { google } from 'googleapis';
import { clients } from '../config/clients';
import { z } from 'zod';
import { scheduleAppointmentReminders } from './wassenger';
import { trackScheduleEvent } from './marketing';
import { DateTime } from 'luxon';

/**
 * Checks appointment availability in Google Calendar.
 * @param args.client_id The client identifier.
 * @param args.start_time Optional start time to check specific slot.
 * @param args.end_time Optional end time to check specific slot.
 * @param args.query_date Optional date to check full day availability.
 */
// Helper to parse input date string into a Luxon DateTime in the client's timezone
const parseInputDate = (dateStr: string, timezone: string): DateTime => {
  // Check for DD.MM.YYYY HH:mm format
  const dmYHM_Match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (dmYHM_Match) {
    return DateTime.fromObject({
        day: parseInt(dmYHM_Match[1]),
        month: parseInt(dmYHM_Match[2]),
        year: parseInt(dmYHM_Match[3]),
        hour: parseInt(dmYHM_Match[4]),
        minute: parseInt(dmYHM_Match[5])
    }, { zone: timezone });
  }

  // Check for DD.MM.YYYY format (start of day)
  const dmY_Match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dmY_Match) {
      return DateTime.fromObject({
          day: parseInt(dmY_Match[1]),
          month: parseInt(dmY_Match[2]),
          year: parseInt(dmY_Match[3]),
          hour: 0, minute: 0, second: 0
      }, { zone: timezone });
  }
  
  // Check for YYYY-MM-DD format (start of day)
  const yMD_Match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yMD_Match) {
    return DateTime.fromObject({
        year: parseInt(yMD_Match[1]),
        month: parseInt(yMD_Match[2]),
        day: parseInt(yMD_Match[3]),
        hour: 0, minute: 0, second: 0
    }, { zone: timezone });
  }

  // Fallback to ISO parsing, setting zone
  const iso = DateTime.fromISO(dateStr, { zone: timezone });
  if (iso.isValid) return iso;

  throw new Error(`Invalid date format: ${dateStr}`);
};

export const calendarCheckAvailability = async (args: { client_id: string; start_time?: string; end_time?: string; query_date?: string; sede?: string }) => {
  const { client_id, start_time, end_time, query_date, sede } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  // Determine which calendars to check
  let availabilityCalendars = clientConfig.google.availabilityCalendars;
  
  const strategy = clientConfig.availabilityStrategy || 'PER_LOCATION';

  if (strategy === 'GLOBAL') {
    availabilityCalendars = clientConfig.google.availabilityCalendars;
  } else {
    if (sede) {
      if (clientConfig.locations && clientConfig.locations[sede]) {
        availabilityCalendars = clientConfig.locations[sede].google.availabilityCalendars;
      } else {
         throw new Error(`Location (sede) '${sede}' not found for client ${client_id}`);
      }
    }
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: clientConfig.google.serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  let targetDate: DateTime;
  if (start_time) {
    targetDate = parseInputDate(start_time, clientConfig.timezone);
  } else if (query_date) {
    targetDate = parseInputDate(query_date, clientConfig.timezone);
  } else {
    targetDate = DateTime.now().setZone(clientConfig.timezone); 
  }

  // Calculate search window in UTC
  const searchStart = targetDate.startOf('day').minus({ days: 2 }).toUTC();
  const searchEnd = targetDate.endOf('day').plus({ days: 2 }).toUTC();

  try {
    const calendarPromises = availabilityCalendars.map(async (calId) => {
      try {
        const response = await calendar.events.list({
          calendarId: calId,
          timeMin: searchStart.toISO()!,
          timeMax: searchEnd.toISO()!,
          singleEvents: true,
          orderBy: 'startTime',
        });
        return response.data.items || [];
      } catch (err) {
        console.error(`Error fetching events from ${calId}:`, err);
        return []; 
      }
    });

    const results = await Promise.all(calendarPromises);
    const allEvents = results.flat();

    // Filter events to only those that fall within the target day in the client's timezone
    let targetDateString: string;
    
    if (query_date) {
        targetDateString = query_date; // Trust the string if provided
    } else {
        // Otherwise derive YYYY-MM-DD from the targetDate object we built
        targetDateString = targetDate.toFormat('yyyy-MM-dd');
    }
    
    const events = allEvents.filter(e => {
      if (!e.start?.dateTime) return false;
      // Parse event time in client's timezone
      const eventTime = DateTime.fromISO(e.start.dateTime).setZone(clientConfig.timezone);
      return eventTime.toFormat('yyyy-MM-dd') === targetDateString;
    }).sort((a, b) => {
      const tA = DateTime.fromISO(a.start?.dateTime || '').toMillis();
      const tB = DateTime.fromISO(b.start?.dateTime || '').toMillis();
      return tA - tB;
    });
    
    const busySlots = events.map(e => {
      const start = e.start?.dateTime ? DateTime.fromISO(e.start.dateTime).setZone(clientConfig.timezone).toFormat('hh:mm a') : 'N/A';
      const end = e.end?.dateTime ? DateTime.fromISO(e.end.dateTime).setZone(clientConfig.timezone).toFormat('hh:mm a') : 'N/A';
      return `${start} - ${end} (Ocupado)`;
    });

    const dayContext = busySlots.length > 0 
      ? `Agenda del día:\n${busySlots.join('\n')}` 
      : "Todo el día está libre.";

    // 3. Check Specific Slot (if requested)
    let isSpecificSlotAvailable = true;
    let conflictDetails = null;

    if (start_time && end_time) {
      // Parse inputs into specific Timezone-aware DateTimes
      const checkStart = parseInputDate(start_time, clientConfig.timezone);
      const checkEnd = parseInputDate(end_time, clientConfig.timezone);

      // Conflict Check using Milliseconds comparison (Epoch is universal)
      const conflict = events.find(e => {
        const eventStart = DateTime.fromISO(e.start?.dateTime || '').toMillis();
        const eventEnd = DateTime.fromISO(e.end?.dateTime || '').toMillis();
        
        const checkStartMs = checkStart.toMillis();
        const checkEndMs = checkEnd.toMillis();

        return (checkStartMs < eventEnd && checkEndMs > eventStart); 
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
  sede?: string;
}) => {
  const { client_id, patient_data, start_time, end_time, description, sede } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  // Determine booking calendar
  let availabilityCalendars = clientConfig.google.availabilityCalendars;
  let bookingCalendarId = clientConfig.google.bookingCalendarId;
  let locationConfig = null;
  const strategy = clientConfig.availabilityStrategy || 'PER_LOCATION';

  // 1. Resolve Location & Booking Calendar (Where the event lives)
  if (sede) {
    if (clientConfig.locations && clientConfig.locations[sede]) {
      // If we have a specific location, we default to its booking calendar
      bookingCalendarId = clientConfig.locations[sede].google.bookingCalendarId;
      locationConfig = clientConfig.locations[sede];
      
      // If Strategy is PER_LOCATION, we also scope usage check to this location
      if (strategy === 'PER_LOCATION') {
        availabilityCalendars = clientConfig.locations[sede].google.availabilityCalendars;
      }
    } else {
      throw new Error(`Location (sede) '${sede}' not found for client ${client_id}`);
    }
  }

  // 2. If Strategy is GLOBAL, override availabilityCalendars to top-level (shared resources)
  if (strategy === 'GLOBAL') {
    availabilityCalendars = clientConfig.google.availabilityCalendars;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: clientConfig.google.serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });


  const checkPromises = availabilityCalendars.map(async (calId) => {
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
      calendarId: bookingCalendarId,
      requestBody: event,
    });


    await scheduleAppointmentReminders(
      client_id, 
      patient_data.telefono, 
      start_time, 
      patient_data.nombre,
      locationConfig // Pass location config if available
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
