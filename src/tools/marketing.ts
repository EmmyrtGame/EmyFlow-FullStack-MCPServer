import axios from 'axios';
import crypto from 'crypto';
import { clients } from '../config/clients';

const hashData = (data: string) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const capiSendEvent = async (args: {
  client_id: string;
  event_name: "Lead" | "Purchase" | "Schedule";
  user_data: { phone?: string; email?: string; fbp?: string; fbc?: string };
}) => {
  const { client_id, event_name, user_data } = args;
  const clientConfig = clients[client_id];

  if (!clientConfig) {
    throw new Error(`Client ${client_id} not found`);
  }

  const hashedUserData: any = {};
  if (user_data.email) hashedUserData.em = hashData(user_data.email.toLowerCase().trim());
  if (user_data.phone) hashedUserData.ph = hashData(user_data.phone.replace(/[^0-9]/g, ''));
  if (user_data.fbp) hashedUserData.fbp = user_data.fbp;
  if (user_data.fbc) hashedUserData.fbc = user_data.fbc;

  const payload = {
    data: [
      {
        event_name: event_name,
        event_time: Math.floor(Date.now() / 1000),
        user_data: hashedUserData,
        action_source: "website", // Or 'chat' depending on context
      },
    ],
    access_token: clientConfig.meta.accessToken,
  };

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
