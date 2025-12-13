import { Request, Response } from 'express';
import { analyticsService, EventType } from '../../services/analytics.service';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

class AnalyticsController {
  /**
   * GET /api/admin/clients/:id/analytics
   * Returns aggregated stats and recent events for a client.
   * Supports optional date filtering via query params.
   * Respects client timezone for date filtering.
   */
  async getClientAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;

      // If date range provided, calculate stats from events within range
      if (startDateStr && endDateStr) {
        // Get client timezone
        const client = await prisma.client.findUnique({
          where: { id },
          select: { timezone: true },
        });
        const timezone = client?.timezone || 'America/Mexico_City';

        // Convert date strings to start/end of day in client timezone, then to UTC
        const startDate = DateTime.fromISO(startDateStr, { zone: timezone })
          .startOf('day')
          .toUTC()
          .toJSDate();
        
        const endDate = DateTime.fromISO(endDateStr, { zone: timezone })
          .endOf('day')
          .toUTC()
          .toJSDate();

        const [filteredStats, dailyBreakdown, recentEvents] = await Promise.all([
          analyticsService.getStatsByDateRange(id, startDate, endDate),
          analyticsService.getDailyBreakdown(id, startDate, endDate, timezone),
          analyticsService.getClientEvents(id, { 
            limit: 10, 
            startDate, 
            endDate 
          }),
        ]);

        res.json({
          stats: {
            filtered: filteredStats,
            dateRange: {
              start: startDateStr,
              end: endDateStr,
            },
          },
          dailyBreakdown,
          recentEvents: recentEvents.data,
        });
      } else {
        // No date filter - return cached lifetime/monthly stats
        const [stats, recentEvents] = await Promise.all([
          analyticsService.getClientStats(id),
          analyticsService.getClientEvents(id, { limit: 10 }),
        ]);

        res.json({
          stats,
          recentEvents: recentEvents.data,
        });
      }
    } catch (error) {
      console.error('Get Analytics error:', error);
      res.status(500).json({ message: 'Error fetching analytics' });
    }
  }

  /**
   * GET /api/admin/clients/:id/events
   * Returns paginated events for a client with optional filters.
   * Respects client timezone for date filtering.
   */
  async getClientEvents(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const eventType = req.query.eventType as EventType | undefined;
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (startDateStr || endDateStr) {
        // Get client timezone
        const client = await prisma.client.findUnique({
          where: { id },
          select: { timezone: true },
        });
        const timezone = client?.timezone || 'America/Mexico_City';

        if (startDateStr) {
          startDate = DateTime.fromISO(startDateStr, { zone: timezone })
            .startOf('day')
            .toUTC()
            .toJSDate();
        }
        if (endDateStr) {
          endDate = DateTime.fromISO(endDateStr, { zone: timezone })
            .endOf('day')
            .toUTC()
            .toJSDate();
        }
      }

      const result = await analyticsService.getClientEvents(id, {
        page,
        limit,
        eventType,
        startDate,
        endDate,
      });

      res.json(result);
    } catch (error) {
      console.error('Get Events error:', error);
      res.status(500).json({ message: 'Error fetching events' });
    }
  }
}

export const analyticsController = new AnalyticsController();


