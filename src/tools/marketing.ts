import axios from 'axios';
import crypto from 'crypto';
import { clients } from '../config/clients';

const hashData = (data: string) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};


export const buildCapiPayload = (args: any, clientConfig: any) => {
  const { event_name, user_data, event_source_url, event_id, action_source = "website" } = args;

  const hashedUserData: any = {};
  if (user_data.email) hashedUserData.em = hashData(user_data.email.toLowerCase().trim());
  if (user_data.phone) hashedUserData.ph = hashData(user_data.phone.replace(/[^0-9]/g, ''));
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

  return {
    data: [eventData],
    access_token: clientConfig.meta.accessToken,
  };
};

export const capiSendEvent = async (args: {
  client_id: string;
  event_name: "Lead" | "Purchase" | "Schedule";
  user_data: { 
    phone?: string; 
    email?: string; 
    fbp?: string; 
    fbc?: string;
    client_user_agent?: string;
    client_ip_address?: string;
  };
  event_source_url?: string;
  event_id?: string;
  action_source?: string;
}) => {
  const { client_id } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  const payload = buildCapiPayload(args, clientConfig);

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${clientConfig.meta.pixelId}/events`,
      payload
    );
    return { content: [{ type: "text", text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    console.error('Error sending CAPI event:', error.response?.data || error.message);
    throw new Error(`Failed to send CAPI event: ${error.message}`);
  }
};
