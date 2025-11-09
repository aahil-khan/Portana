/**
 * Analytics Admin Service
 * Tracks portfolio analytics and metrics
 */

export interface AnalyticsEvent {
  id: string;
  type: 'view' | 'click' | 'interaction' | 'chat';
  resource_id: string;
  resource_type: 'project' | 'profile' | 'chat_session';
  user_id?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface AnalyticsMetrics {
  total_views: number;
  total_clicks: number;
  total_interactions: number;
  total_chat_sessions: number;
  avg_session_duration: number;
  most_viewed_projects: string[];
  events_by_type: Record<string, number>;
}

interface EventStore {
  [id: string]: AnalyticsEvent;
}

class AnalyticsAdminService {
  private events: EventStore = {};
  private eventCounter = 0;

  /**
   * Record an analytics event
   */
  recordEvent(event: Omit<AnalyticsEvent, 'id'>): AnalyticsEvent {
    const id = `evt_${++this.eventCounter}_${Date.now()}`;
    const recorded: AnalyticsEvent = {
      ...event,
      id,
    };

    this.events[id] = recorded;
    return recorded;
  }

  /**
   * Get events by type
   */
  getEventsByType(type: AnalyticsEvent['type']): AnalyticsEvent[] {
    return Object.values(this.events)
      .filter((e) => e.type === type)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Get events for a resource
   */
  getResourceEvents(resourceId: string): AnalyticsEvent[] {
    return Object.values(this.events)
      .filter((e) => e.resource_id === resourceId)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Get metrics summary
   */
  getMetrics(): AnalyticsMetrics {
    const events = Object.values(this.events);

    const metrics: AnalyticsMetrics = {
      total_views: events.filter((e) => e.type === 'view').length,
      total_clicks: events.filter((e) => e.type === 'click').length,
      total_interactions: events.filter((e) => e.type === 'interaction').length,
      total_chat_sessions: events.filter((e) => e.type === 'chat').length,
      avg_session_duration: 0,
      most_viewed_projects: [],
      events_by_type: {
        view: events.filter((e) => e.type === 'view').length,
        click: events.filter((e) => e.type === 'click').length,
        interaction: events.filter((e) => e.type === 'interaction').length,
        chat: events.filter((e) => e.type === 'chat').length,
      },
    };

    // Calculate most viewed projects
    const viewCounts: Record<string, number> = {};
    events
      .filter((e) => e.type === 'view' && e.resource_type === 'project')
      .forEach((e) => {
        viewCounts[e.resource_id] = (viewCounts[e.resource_id] || 0) + 1;
      });

    metrics.most_viewed_projects = Object.entries(viewCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    return metrics;
  }

  /**
   * Get events in date range
   */
  getEventsInRange(startDate: Date, endDate: Date): AnalyticsEvent[] {
    return Object.values(this.events).filter((e) => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }

  /**
   * Clear events older than specified days
   */
  clearOldEvents(daysOld: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let removed = 0;
    Object.entries(this.events).forEach(([id, event]) => {
      if (new Date(event.timestamp) < cutoffDate) {
        delete this.events[id];
        removed++;
      }
    });

    return removed;
  }

  /**
   * Get total event count
   */
  getTotalEventCount(): number {
    return Object.keys(this.events).length;
  }

  /**
   * Get events by resource type
   */
  getEventsByResourceType(
    resourceType: AnalyticsEvent['resource_type']
  ): AnalyticsEvent[] {
    return Object.values(this.events).filter((e) => e.resource_type === resourceType);
  }
}

// Singleton instance
let instance: AnalyticsAdminService | null = null;

export function getAnalyticsAdmin(): AnalyticsAdminService {
  if (!instance) {
    instance = new AnalyticsAdminService();
  }
  return instance;
}

export { AnalyticsAdminService };
