import express from 'express';
import axios from 'axios';
import { clientService } from '../services/client.service';
import { trackLeadEvent } from '../tools/marketing';
import { updateContactMetadata } from '../tools/crm';
import { analyticsService } from '../services/analytics.service';

const router = express.Router();

/**
 * In-memory buffer to group incoming messages by user.
 * structure: { [userId]: { messages: string[], timer: NodeJS.Timeout } }
 */
const messageBuffer: Record<string, { messages: string[], timer: NodeJS.Timeout }> = {};

/**
 * In-memory state for human handoff suppression.
 * maps userId (JID) -> timestamp (Date.now()) of last human interaction.
 */
const humanHandoffState: Record<string, number> = {};
const HUMAN_HANDOFF_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * In-memory cache to deduplicate LEAD events.
 * Prevents race condition where multiple messages arrive before Wassenger propagates metadata.
 * Key: `${clientSlug}:${phone}`, Value: timestamp when lead was sent.
 */
const leadSentCache: Record<string, number> = {};
const LEAD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (enough for Wassenger to propagate metadata)

/**
 * Cleans up all expired entries from in-memory caches to prevent memory bloat.
 * Called periodically and when adding new cache entries.
 */
const cleanupAllCaches = () => {
  const now = Date.now();
  let leadsCleaned = 0;
  let handoffsCleaned = 0;

  // Cleanup leadSentCache
  for (const key in leadSentCache) {
    if (now - leadSentCache[key] > LEAD_CACHE_TTL_MS) {
      delete leadSentCache[key];
      leadsCleaned++;
    }
  }

  // Cleanup humanHandoffState
  for (const key in humanHandoffState) {
    if (now - humanHandoffState[key] > HUMAN_HANDOFF_TIMEOUT_MS) {
      delete humanHandoffState[key];
      handoffsCleaned++;
    }
  }

  if (leadsCleaned > 0 || handoffsCleaned > 0) {
    console.log(`[Cache Cleanup] Removed ${leadsCleaned} expired leads, ${handoffsCleaned} expired handoffs`);
  }
};

// Periodic cleanup every 5 minutes to prevent memory bloat
setInterval(cleanupAllCaches, 5 * 60 * 1000);


const BUFFER_DELAY_MS = 15000; // 15 seconds window (from original code, comment said 3s but value 15000)

// Custom Webhook URL is now fetched dynamically from Client config

router.post('/whatsapp', async (req, res) => {
  try {
    const { data, event } = req.body;

    // ---------------------------------------------------------
    // 1. OUTBOUND MESSAGE HANDLER (Detect Human Intervention)
    // ---------------------------------------------------------
    if (event === 'message:out:new') {
      // According to user docs:
      // - Human message: has 'agent' field (e.g. "agent": "68f...")
      // - API message: 'agent' is null/undefined
      if (data && data.agent) {
        // Use 'to' (JID) as the key, consistent with Wassenger unique identifiers
        const targetId = data.to;
        if (targetId) {
          humanHandoffState[targetId] = Date.now();
          console.log(`[Handoff] Human agent detected for ${targetId}. AI paused for 30m.`);

          // Track HANDOFF event for analytics
          const deviceId = req.body.device?.id;
          if (deviceId) {
            clientService.getClientByDeviceId(deviceId).then(config => {
              if (config) {
                analyticsService.recordEvent(config.slug, 'HANDOFF', targetId);
              }
            }).catch(() => { });
          }
        }
      } else {
        // API message, ignored
      }

      return res.status(200).send('OK');
    }

    if (!data || !data.fromNumber || !data.body) {
      console.log('Webhook received but missing data:', req.body);
      return res.status(200).send('OK');
    }

    const userId = data.fromNumber; // Used for buffer key in original code
    const userJid = data.from; // JID (e.g. number@c.us) used for handoff lock

    // ---------------------------------------------------------
    // 2. CHECK HANDOFF STATE
    // ---------------------------------------------------------
    if (userJid && humanHandoffState[userJid]) {
      const lastHumanTime = humanHandoffState[userJid];
      const timeElapsed = Date.now() - lastHumanTime;

      if (timeElapsed < HUMAN_HANDOFF_TIMEOUT_MS) {
        console.log(`[Handoff] AI suppressed for ${userJid}. Time remaining: ${Math.ceil((HUMAN_HANDOFF_TIMEOUT_MS - timeElapsed) / 60000)}m`);
        return res.status(200).send('Suppressed by Human Handoff');
      } else {
        // Expired
        delete humanHandoffState[userJid];
        console.log(`[Handoff] Timer expired for ${userJid}. Resuming AI.`);
      }
    } else if (userId && humanHandoffState[userId]) {
      // Fallback check: if state was saved with fromNumber for some reason, or to cover bases
      // But we save with data.to (JID) on outbound.
      // data.from is the JID on inbound. So the above check 'userJid' should suffice.
      // Just in case, let's just stick to JID.
    }

    // ---------------------------------------------------------
    // 2b. CHECK FOR "humano" LABEL (Permanent suppression via MCP tool)
    // ---------------------------------------------------------
    // This is different from the temporary handoff above.
    // When the crmHandoffHuman MCP tool is used, it adds the "humano" label.
    // AI should be suppressed PERMANENTLY until the label is manually removed.
    const chatLabels = data.chat?.labels || [];
    if (chatLabels.includes('humano')) {
      console.log(`[Handoff] AI permanently suppressed for ${userJid}: "humano" label detected in chat.`);
      return res.status(200).send('Suppressed by "humano" label');
    }

    // ---------------------------------------------------------
    // 3. LEAD TRACKING (Original Logic)
    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // 3a. ANALYTICS: Track incoming message
    // ---------------------------------------------------------
    const deviceId = req.body.device?.id;
    let clientSlug: string | null = null;

    if (deviceId) {
      const clientConfig = await clientService.getClientByDeviceId(deviceId);
      if (clientConfig) {
        clientSlug = clientConfig.slug;

        // Track MESSAGE event
        analyticsService.recordEvent(clientSlug, 'MESSAGE', userId);

        // Track NEW_CONVERSATION if first message
        if (data.meta?.isFirstMessage === true) {
          analyticsService.recordEvent(clientSlug, 'NEW_CONVERSATION', userId);
        }
      }
    }

    // ---------------------------------------------------------
    // 3b. LEAD TRACKING (Original Logic with analytics hook)
    // ---------------------------------------------------------
    if (data.flow === 'inbound' && data.meta && data.meta.isFirstMessage === false) {
      const contactMetadata = data.chat?.contact?.metadata || [];
      const isLeadSent = contactMetadata.some((m: any) => m.key === 'capi_lead_enviado' && m.value === 'true');

      // In-memory deduplication: check cache before sending LEAD
      const leadCacheKey = `${clientSlug}:${userId}`;
      const isLeadInCache = leadSentCache[leadCacheKey] && (Date.now() - leadSentCache[leadCacheKey] < LEAD_CACHE_TTL_MS);

      if (!isLeadSent && !isLeadInCache && deviceId && clientSlug) {
        // Add to cache IMMEDIATELY (before async call) to prevent race conditions
        leadSentCache[leadCacheKey] = Date.now();

        // Cleanup old cache entries periodically (every time we add a new one)
        cleanupAllCaches();

        console.log(`[Webhook] Detected potential Lead for client ${clientSlug} (Device: ${deviceId})`);

        trackLeadEvent({
          client_id: clientSlug,
          user_data: {
            phone: userId // fromNumber
          }
        }).then(async (result) => {
          if (result && result.success) {
            // Track LEAD event for analytics
            analyticsService.recordEvent(clientSlug!, 'LEAD', userId);

            await updateContactMetadata({
              client_id: clientSlug!,
              phone_number: userId,
              metadata: { 'capi_lead_enviado': 'true' }
            }).catch((err: any) => console.error('[Webhook] Failed to update lead metadata:', err));
          } else {
            // If tracking failed, remove from cache so it can be retried on next message
            delete leadSentCache[leadCacheKey];
          }
        }).catch((err: any) => {
          console.error('[Webhook] Failed to track automated Lead:', err);
          // Remove from cache on error so it can be retried
          delete leadSentCache[leadCacheKey];
        });
      } else if (isLeadSent) {
        console.log(`[Webhook] Lead event skipped for ${userId}: 'capi_lead_enviado' metadata already true.`);
      } else if (isLeadInCache) {
        console.log(`[Webhook] Lead event skipped for ${userId}: already in deduplication cache.`);
      }
    }

    // ---------------------------------------------------------
    // 4. MESSAGE BUFFERING (Original Logic)
    // ---------------------------------------------------------
    const messageBody = data.body;

    if (messageBuffer[userId]) {
      clearTimeout(messageBuffer[userId].timer);
      messageBuffer[userId].messages.push(messageBody);
    } else {
      messageBuffer[userId] = {
        messages: [messageBody],
        timer: setTimeout(() => { }, 0) // placeholder
      };
    }

    messageBuffer[userId].timer = setTimeout(async () => {
      const combinedMessage = messageBuffer[userId].messages.join(' ');
      delete messageBuffer[userId];

      console.log(`Processing buffered message for ${userId}: ${combinedMessage}`);

      try {
        // Logic change: Use client-specific webhook URL
        const deviceId = req.body.device?.id;
        const clientConfig = await clientService.getClientByDeviceId(deviceId);
        const webhookUrl = clientConfig?.webhookUrl;

        if (!webhookUrl) {
          console.warn(`[Webhook] No webhook URL configured for client (Device: ${deviceId}). Skipping.`);
          return;
        }

        // Send to Client Webhook
        await axios.post(webhookUrl, {
          ...req.body, // Pass original context
          data: {
            ...data,
            body: combinedMessage
          }
        });
      } catch (error) {
        console.error('Error sending to Make:', error);
      }

    }, BUFFER_DELAY_MS);

    res.status(200).send('Buffered');

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
