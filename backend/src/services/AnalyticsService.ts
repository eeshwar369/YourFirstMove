import Task from '../models/Task';
import ProductivityStreak from '../models/ProductivityStreak';
import logger from '../config/logger';

export interface CompletionRate {
  totalTasks: number;
  completedTasks: number;
  percentage: number;
  period: string;
}

export interface TrendData {
  labels: string[];
  completionRates: number[];
  taskCounts: number[];
}

export interface TaskStatistics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  criticalTasks: number;
  averageCompletionTime: number;
}

export class AnalyticsService {
  async calculateCompletionRate(userId: number, dateFrom: string, dateTo: string): Promise<CompletionRate> {
    try {
      const tasks = await Task.query()
        .where('user_id', userId)
        .whereBetween('due_date', [dateFrom, dateTo]);

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.is_completed).length;
      const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      return {
        totalTasks,
        completedTasks,
        percentage: Math.round(percentage * 100) / 100,
        period: `${dateFrom} to ${dateTo}`,
      };
    } catch (error) {
      logger.error('Completion rate calculation error:', error);
      throw error;
    }
  }

  async getProductivityTrends(userId: number, period: string): Promise<TrendData> {
    try {
      const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
      const labels: string[] = [];
      const completionRates: number[] = [];
      const taskCounts: number[] = [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const tasks = await Task.query()
          .where('user_id', userId)
          .where('due_date', dateStr);

        const total = tasks.length;
        const completed = tasks.filter((t) => t.is_completed).length;
        const rate = total > 0 ? (completed / total) * 100 : 0;

        labels.push(dateStr);
        completionRates.push(Math.round(rate * 100) / 100);
        taskCounts.push(total);
      }

      return { labels, completionRates, taskCounts };
    } catch (error) {
      logger.error('Productivity trends error:', error);
      throw error;
    }
  }

  async calculateStreak(userId: number): Promise<number> {
    try {
      const streak = await ProductivityStreak.query().findOne({ user_id: userId });
      return streak?.current_streak || 0;
    } catch (error) {
      logger.error('Streak calculation error:', error);
      throw error;
    }
  }

  async updateStreakData(userId: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Check if user completed at least one task today
      const todayTasks = await Task.query()
        .where('user_id', userId)
        .where('due_date', today)
        .where('is_completed', true);

      const streak = await ProductivityStreak.query().findOne({ user_id: userId });

      if (!streak) {
        await ProductivityStreak.query().insert({
          user_id: userId,
          current_streak: todayTasks.length > 0 ? 1 : 0,
          longest_streak: todayTasks.length > 0 ? 1 : 0,
          last_activity_date: todayTasks.length > 0 ? new Date(today) : undefined,
        });
        return;
      }

      if (todayTasks.length > 0) {
        const lastActivity = streak.last_activity_date
          ? new Date(streak.last_activity_date).toISOString().split('T')[0]
          : null;

        let newStreak = streak.current_streak;

        if (lastActivity === yesterdayStr) {
          // Continue streak
          newStreak = streak.current_streak + 1;
        } else if (lastActivity !== today) {
          // Start new streak
          newStreak = 1;
        }

        const newLongest = Math.max(newStreak, streak.longest_streak);

        await streak.$query().patch({
          current_streak: newStreak,
          longest_streak: newLongest,
          last_activity_date: new Date(today),
        });
      }
    } catch (error) {
      logger.error('Streak update error:', error);
      throw error;
    }
  }

  async getTaskStatistics(userId: number): Promise<TaskStatistics> {
    try {
      const tasks = await Task.query().where('user_id', userId);

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.is_completed).length;
      const pendingTasks = totalTasks - completedTasks;
      const criticalTasks = tasks.filter((t) => t.is_critical && !t.is_completed).length;

      // Calculate average completion time
      const completedWithTime = tasks.filter((t) => t.is_completed && t.completed_at);
      const avgTime =
        completedWithTime.length > 0
          ? completedWithTime.reduce((sum, t) => {
              const created = new Date(t.created_at).getTime();
              const completed = new Date(t.completed_at!).getTime();
              return sum + (completed - created);
            }, 0) / completedWithTime.length
          : 0;

      return {
        totalTasks,
        completedTasks,
        pendingTasks,
        criticalTasks,
        averageCompletionTime: Math.round(avgTime / (1000 * 60 * 60)), // Convert to hours
      };
    } catch (error) {
      logger.error('Task statistics error:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();
