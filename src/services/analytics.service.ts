import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Event types that can be tracked
export type EventType = 'LEAD' | 'APPOINTMENT' | 'MESSAGE' | 'HANDOFF' | 'NEW_CONVERSATION';

// Map event types to their corresponding counter fields
const eventToLifetimeField: Record<EventType, keyof typeof statsFields> = {
  LEAD: 'totalLeads',
  APPOINTMENT: 'totalAppointments',
  MESSAGE: 'totalMessages',
  HANDOFF: 'totalHandoffs',
  NEW_CONVERSATION: 'totalNewConversations',
};

const eventToMonthlyField: Record<EventType, keyof typeof statsFields> = {
  LEAD: 'monthlyLeads',
  APPOINTMENT: 'monthlyAppointments',
  MESSAGE: 'monthlyMessages',
  HANDOFF: 'monthlyHandoffs',
  NEW_CONVERSATION: 'monthlyNewConversations',
};

// Type helper for stats fields
const statsFields = {
  totalLeads: 0,
  totalAppointments: 0,
  totalMessages: 0,
  totalHandoffs: 0,
  totalNewConversations: 0,
  monthlyLeads: 0,
  monthlyAppointments: 0,
  monthlyMessages: 0,
  monthlyHandoffs: 0,
  monthlyNewConversations: 0,
};

class AnalyticsService {
  // Cache for slug to id mapping
  private slugToIdCache: Map<string, string> = new Map();

  /**
   * Resolves a client slug to its database ID, using cache.
   */
  private async resolveClientId(slug: string): Promise<string | null> {
    if (this.slugToIdCache.has(slug)) {
      return this.slugToIdCache.get(slug)!;
    }

    const client = await prisma.client.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (client) {
      this.slugToIdCache.set(slug, client.id);
      return client.id;
    }
    return null;
  }

  /**
   * Records an event and increments the corresponding counters atomically.
   * Creates ClientStats record if it doesn't exist.
   * @param clientSlug The client's slug identifier (will be resolved to ID)
   */
  async recordEvent(
    clientSlug: string,
    eventType: EventType,
    phone?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const clientId = await this.resolveClientId(clientSlug);
    if (!clientId) {
      console.warn(`[Analytics] Client with slug ${clientSlug} not found, skipping event.`);
      return;
    }

    const currentMonth = this.getCurrentMonth();
    const lifetimeField = eventToLifetimeField[eventType];
    const monthlyField = eventToMonthlyField[eventType];

    try {
      // Use transaction for atomicity
      await prisma.$transaction(async (tx) => {
        // 1. Create the event record
        await tx.clientEvent.create({
          data: {
            clientId,
            eventType,
            phone,
            metadata,
          },
        });

        // 2. Upsert ClientStats with counter increment
        const existingStats = await tx.clientStats.findUnique({
          where: { clientId },
        });

        if (!existingStats) {
          // Create new stats record
          const newStats: any = {
            clientId,
            currentMonth,
            [lifetimeField]: 1,
            [monthlyField]: 1,
          };
          await tx.clientStats.create({ data: newStats });
        } else {
          // Check if month has changed (reset monthly counters)
          const needsMonthReset = existingStats.currentMonth !== currentMonth;
          
          const updateData: any = {
            [lifetimeField]: { increment: 1 },
          };

          if (needsMonthReset) {
            // Reset all monthly counters and set new month
            updateData.monthlyLeads = 0;
            updateData.monthlyAppointments = 0;
            updateData.monthlyMessages = 0;
            updateData.monthlyHandoffs = 0;
            updateData.monthlyNewConversations = 0;
            updateData.currentMonth = currentMonth;
            // Then increment the relevant one
            updateData[monthlyField] = 1;
          } else {
            updateData[monthlyField] = { increment: 1 };
          }

          await tx.clientStats.update({
            where: { clientId },
            data: updateData,
          });
        }
      });
    } catch (error) {
      console.error(`[Analytics] Failed to record ${eventType} event for client ${clientId}:`, error);
      // Don't throw - analytics should not break main flows
    }
  }

  /**
   * Gets aggregated stats for a client.
   */
  async getClientStats(clientId: string) {
    const stats = await prisma.clientStats.findUnique({
      where: { clientId },
    });

    if (!stats) {
      // Return zeros if no stats exist yet
      return {
        lifetime: {
          leads: 0,
          appointments: 0,
          messages: 0,
          handoffs: 0,
          newConversations: 0,
        },
        monthly: {
          leads: 0,
          appointments: 0,
          messages: 0,
          handoffs: 0,
          newConversations: 0,
          month: this.getCurrentMonth(),
        },
      };
    }

    // Check if month has changed (return zeros for current month if outdated)
    const currentMonth = this.getCurrentMonth();
    const isCurrentMonth = stats.currentMonth === currentMonth;

    return {
      lifetime: {
        leads: stats.totalLeads,
        appointments: stats.totalAppointments,
        messages: stats.totalMessages,
        handoffs: stats.totalHandoffs,
        newConversations: stats.totalNewConversations,
      },
      monthly: {
        leads: isCurrentMonth ? stats.monthlyLeads : 0,
        appointments: isCurrentMonth ? stats.monthlyAppointments : 0,
        messages: isCurrentMonth ? stats.monthlyMessages : 0,
        handoffs: isCurrentMonth ? stats.monthlyHandoffs : 0,
        newConversations: isCurrentMonth ? stats.monthlyNewConversations : 0,
        month: currentMonth,
      },
    };
  }

  /**
   * Gets paginated events for a client with optional filters.
   */
  async getClientEvents(
    clientId: string,
    options: {
      page?: number;
      limit?: number;
      eventType?: EventType;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const { page = 1, limit = 20, eventType, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where: any = { clientId };

    if (eventType) {
      where.eventType = eventType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [events, total] = await prisma.$transaction([
      prisma.clientEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          phone: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.clientEvent.count({ where }),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Helper to get current month in YYYY-MM format.
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Gets stats aggregated from events within a date range.
   * More flexible than cached stats for custom date filtering.
   */
  async getStatsByDateRange(
    clientId: string,
    startDate: Date,
    endDate: Date
  ) {
    const events = await prisma.clientEvent.groupBy({
      by: ['eventType'],
      where: {
        clientId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        eventType: true,
      },
    });

    const stats = {
      leads: 0,
      appointments: 0,
      messages: 0,
      handoffs: 0,
      newConversations: 0,
    };

    for (const event of events) {
      switch (event.eventType) {
        case 'LEAD':
          stats.leads = event._count.eventType;
          break;
        case 'APPOINTMENT':
          stats.appointments = event._count.eventType;
          break;
        case 'MESSAGE':
          stats.messages = event._count.eventType;
          break;
        case 'HANDOFF':
          stats.handoffs = event._count.eventType;
          break;
        case 'NEW_CONVERSATION':
          stats.newConversations = event._count.eventType;
          break;
      }
    }

    return stats;
  }

  /**
   * Gets daily breakdown of events within a date range.
   * Groups events by day in the specified timezone.
   */
  async getDailyBreakdown(
    clientId: string,
    startDate: Date,
    endDate: Date,
    timezone: string = 'America/Mexico_City'
  ) {
    // Import luxon's DateTime for timezone conversion
    const { DateTime } = await import('luxon');
    
    // Get all events in range and group by day in application code
    // (MySQL doesn't have easy date truncation in groupBy)
    const events = await prisma.clientEvent.findMany({
      where: {
        clientId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day in client timezone
    const dailyMap: Record<string, Record<string, number>> = {};

    for (const event of events) {
      // Convert UTC to client timezone and get the day
      const dayKey = DateTime.fromJSDate(event.createdAt, { zone: 'UTC' })
        .setZone(timezone)
        .toFormat('yyyy-MM-dd');
      
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = {
          leads: 0,
          appointments: 0,
          messages: 0,
          handoffs: 0,
          newConversations: 0,
          total: 0,
        };
      }

      dailyMap[dayKey].total++;

      switch (event.eventType) {
        case 'LEAD':
          dailyMap[dayKey].leads++;
          break;
        case 'APPOINTMENT':
          dailyMap[dayKey].appointments++;
          break;
        case 'MESSAGE':
          dailyMap[dayKey].messages++;
          break;
        case 'HANDOFF':
          dailyMap[dayKey].handoffs++;
          break;
        case 'NEW_CONVERSATION':
          dailyMap[dayKey].newConversations++;
          break;
      }
    }

    // Convert to array and sort by date
    return Object.entries(dailyMap)
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const analyticsService = new AnalyticsService();

