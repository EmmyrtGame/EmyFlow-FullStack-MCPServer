import axios from 'axios';
import crypto from 'crypto';
import { clientService } from '../services/client.service';

/**
 * Hashes a string using SHA-256.
 * @param data The string to hash.
 * @returns The hex-encoded hash.
 */
const hashData = (data: string) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Normalizes a name by trimming and lowercasing.
 * Per Meta CAPI docs: "Using Roman alphabet a-z characters is recommended. Lowercase only.
 * If using special characters, the text must be encoded in UTF-8 format."
 * NOTE: Accents ARE preserved (e.g., "Valéry" -> "valéry").
 * @param name The name to normalize.
 * @returns The normalized name.
 */
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .trim();
  // Note: Accents preserved per Meta docs - UTF-8 encoding is handled by JS/Node.js automatically
};

/**
 * Builds the payload for Meta CAPI.
 * @param args The event arguments.
 * @param clientConfig The client configuration.
 * @returns The formatted payload.
 */
export const buildCapiPayload = (args: any, clientConfig: any) => {
  const { event_name, user_data, event_source_url, event_id, action_source = "website", test_event_code } = args;

  const hashedUserData: any = {};
  
  // Email: lowercase, trim, then hash
  if (user_data.email) hashedUserData.em = hashData(user_data.email.toLowerCase().trim());
  
  // Phone: remove all non-digits, then hash
  if (user_data.phone) hashedUserData.ph = hashData(user_data.phone.replace(/[^0-9]/g, ''));
  
  // First Name: normalize (lowercase, no accents), then hash
  if (user_data.firstName) hashedUserData.fn = hashData(normalizeName(user_data.firstName));
  
  // Last Name: normalize (lowercase, no accents), then hash
  if (user_data.lastName) hashedUserData.ln = hashData(normalizeName(user_data.lastName));
  
  // Country: must be ISO 3166-1 alpha-2 (e.g., 'mx', 'us'), lowercase, then hash
  if (user_data.country) hashedUserData.country = hashData(user_data.country.toLowerCase().trim());
  
  // Browser/Click identifiers (not available in WhatsApp flows)
  if (user_data.fbp) hashedUserData.fbp = user_data.fbp;
  if (user_data.fbc) hashedUserData.fbc = user_data.fbc;
  if (user_data.client_user_agent) hashedUserData.client_user_agent = user_data.client_user_agent;
  if (user_data.client_ip_address) hashedUserData.client_ip_address = user_data.client_ip_address;

  const eventData: any = {
    event_name: event_name,
    event_time: Math.floor(Date.now() / 1000),
    user_data: hashedUserData,
    action_source: action_source,
  };

  if (event_source_url) eventData.event_source_url = event_source_url;
  if (event_id) eventData.event_id = event_id;

  const payload: any = {
    data: [eventData],
    access_token: clientConfig.meta.accessToken,
  };
  
  if (test_event_code) {
    payload.test_event_code = test_event_code;
  }

  return payload;
};

/**
 * Tracks a 'Schedule' event to Meta CAPI.
 * @param args.client_id The client identifier.
 * @param args.user_data User data for matching.
 * @param args.user_data.phone Patient's phone number (required).
 * @param args.user_data.firstName Patient's first name (recommended for better EMQ).
 * @param args.user_data.lastName Patient's last name (optional).
 * @param args.user_data.email Patient's email (optional, highly recommended).
 * @param args.user_data.country ISO 3166-1 alpha-2 country code (e.g., 'mx', 'us').
 * @param args.test_event_code Optional test event code for debugging.
 */
export const trackScheduleEvent = async (args: {
  client_id: string;
  user_data: { 
    phone: string; 
    firstName?: string;
    lastName?: string;
    email?: string;
    country?: string;
    fbp?: string; 
    fbc?: string;
  };
  test_event_code?: string;
}) => {
  const { client_id, user_data, test_event_code } = args;
  try {
    const clientConfig = await clientService.getClientConfig(client_id);
    if (!clientConfig) {
      console.warn(`[Marketing] Client ${client_id} not found, skipping tracking.`);
      return;
    }

    const payload = buildCapiPayload({
      event_name: 'Schedule',
      user_data: user_data,
      action_source: 'chat',
      test_event_code: test_event_code
    }, clientConfig);

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${clientConfig.meta.pixelId}/events`,
      payload
    );
    console.log(`[Marketing] Schedule event tracked for ${user_data.phone}:`, response.data);
    return { success: true };
  } catch (error: any) {
    console.error('[Marketing] Error tracking schedule event:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Tracks a 'Lead' event to Meta CAPI.
 * @param args.client_id The client identifier.
 * @param args.user_data User data for matching (phone, email, fbp, fbc).
 * @param args.test_event_code Optional test event code.
 */
export const trackLeadEvent = async (args: {
  client_id: string;
  user_data: { 
    phone: string; 
    email?: string; 
    fbp?: string; 
    fbc?: string;
  };
  test_event_code?: string;
}) => {
  const { client_id, user_data, test_event_code } = args;
  
  try {
    const clientConfig = await clientService.getClientConfig(client_id);
    if (!clientConfig) {
      console.warn(`[Marketing] Client ${client_id} not found, skipping tracking.`);
      return;
    }

    const payload = buildCapiPayload({
      event_name: 'Lead',
      user_data: user_data,
      action_source: 'chat',
      test_event_code: test_event_code
    }, clientConfig);

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${clientConfig.meta.pixelId}/events`,
      payload
    );
    console.log(`[Marketing] Lead event tracked for ${user_data.phone}:`, response.data);
    return { success: true };
  } catch (error: any) {
    console.error('[Marketing] Error tracking Lead event:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};
