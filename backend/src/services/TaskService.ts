import Task from '../models/Task';
import logger from '../config/logger';
import { AnalyticsService } from './AnalyticsService';

export interface CreateTaskDTO {
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  endTime?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  isCritical?: boolean;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  endTime?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  isCritical?: boolean;
  isCompleted?: boolean;
  displayOrder?: number;
}

export interface TaskFilters {
  priority?: string;
  isCompleted?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export class TaskService {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  async createTask(userId: number, taskData: CreateTaskDTO): Promise<Task> {
    try {
      // Default to today if no date provided
      const dueDate = taskData.dueDate 
        ? taskData.dueDate 
        : new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      const task = await Task.query().insert({
        user_id: userId,
        title: taskData.title,
        description: taskData.description,
        due_date: dueDate, // Store as string in YYYY-MM-DD format
        due_time: taskData.dueTime,
        end_time: taskData.endTime,
        priority: taskData.priority || 'medium',
        is_critical: taskData.isCritical || false,
        is_completed: false,
        display_order: 0,
      });

      logger.info(`Task created: ${task.id} for user ${userId}`);
      return task;
    } catch (error) {
      logger.error('Task creation error:', error);
      throw error;
    }
  }

  async updateTask(taskId: number, userId: number, updates: UpdateTaskDTO): Promise<Task> {
    try {
      const task = await Task.query().findById(taskId);
      
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      // Build update object, filtering out empty strings and undefined values
      const updateData: any = {};
      
      if (updates.title) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description || null;
      
      // Handle date - ensure it's always in YYYY-MM-DD format
      if (updates.dueDate) {
        const dateOnly = updates.dueDate.split('T')[0]; // Remove time component if present
        updateData.due_date = dateOnly;
      }
      
      if (updates.dueTime !== undefined) updateData.due_time = updates.dueTime || null;
      if (updates.endTime !== undefined) updateData.end_time = updates.endTime || null;
      if (updates.priority) updateData.priority = updates.priority;
      if (updates.isCritical !== undefined) updateData.is_critical = updates.isCritical;
      if (updates.isCompleted !== undefined) updateData.is_completed = updates.isCompleted;
      if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;

      console.log('Updating task with data:', updateData); // Debug log

      const updatedTask = await task.$query().patchAndFetch(updateData);

      logger.info(`Task updated: ${taskId}`);
      return updatedTask;
    } catch (error) {
      logger.error('Task update error:', error);
      throw error;
    }
  }

  async deleteTask(taskId: number, userId: number): Promise<void> {
    try {
      const task = await Task.query().findById(taskId);
      
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      await Task.query().deleteById(taskId);
      logger.info(`Task deleted: ${taskId}`);
    } catch (error) {
      logger.error('Task deletion error:', error);
      throw error;
    }
  }

  async getTask(taskId: number, userId: number): Promise<Task> {
    try {
      const task = await Task.query().findById(taskId);
      
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      return task;
    } catch (error) {
      logger.error('Task retrieval error:', error);
      throw error;
    }
  }

  async listTasks(
    userId: number,
    filters: TaskFilters,
    pagination: Pagination
  ): Promise<{ tasks: Task[]; total: number }> {
    try {
      let query = Task.query().where('user_id', userId);

      // Apply filters
      if (filters.priority) {
        query = query.where('priority', filters.priority);
      }

      if (filters.isCompleted !== undefined) {
        query = query.where('is_completed', filters.isCompleted);
      }

      if (filters.dateFrom) {
        query = query.where('due_date', '>=', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.where('due_date', '<=', filters.dateTo);
      }

      if (filters.search) {
        query = query.where((builder) => {
          builder
            .where('title', 'like', `%${filters.search}%`)
            .orWhere('description', 'like', `%${filters.search}%`);
        });
      }

      // Get total count
      const total = await query.resultSize();

      // Apply pagination
      const tasks = await query
        .orderBy('due_date', 'asc')
        .orderBy('due_time', 'asc')
        .orderBy('display_order', 'asc')
        .page(pagination.page - 1, pagination.pageSize);

      return { tasks: tasks.results, total };
    } catch (error) {
      logger.error('Task listing error:', error);
      throw error;
    }
  }

  async markComplete(taskId: number, userId: number): Promise<Task> {
    try {
      const task = await this.getTask(taskId, userId);
      
      const updatedTask = await task.$query().patchAndFetch({
        is_completed: true,
        completed_at: new Date(),
      });

      // Update productivity metrics
      await this.analyticsService.updateStreakData(userId);

      logger.info(`Task marked complete: ${taskId}`);
      return updatedTask;
    } catch (error) {
      logger.error('Task completion error:', error);
      throw error;
    }
  }

  async markIncomplete(taskId: number, userId: number): Promise<Task> {
    try {
      const task = await this.getTask(taskId, userId);
      
      const updatedTask = await task.$query().patchAndFetch({
        is_completed: false,
        completed_at: undefined as any,
      });

      // Update productivity metrics
      await this.analyticsService.updateStreakData(userId);

      logger.info(`Task marked incomplete: ${taskId}`);
      return updatedTask;
    } catch (error) {
      logger.error('Task incompletion error:', error);
      throw error;
    }
  }

  async reorderTasks(userId: number, taskIds: number[]): Promise<void> {
    try {
      // Update display_order for each task
      const promises = taskIds.map((taskId, index) =>
        Task.query()
          .findById(taskId)
          .where('user_id', userId)
          .patch({ display_order: index })
      );

      await Promise.all(promises);
      logger.info(`Tasks reordered for user ${userId}`);
    } catch (error) {
      logger.error('Task reordering error:', error);
      throw error;
    }
  }

  async getTasksByDate(userId: number, date: string): Promise<Task[]> {
    try {
      // Ensure date is in YYYY-MM-DD format
      const dateOnly = date.split('T')[0];
      
      const tasks = await Task.query()
        .where('user_id', userId)
        .whereRaw('DATE(due_date) = ?', [dateOnly])
        .orderBy('due_time', 'asc')
        .orderBy('display_order', 'asc');

      return tasks;
    } catch (error) {
      logger.error('Tasks by date retrieval error:', error);
      throw error;
    }
  }

  async getTasksByMonth(userId: number, month: string): Promise<Task[]> {
    try {
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum.padStart(2, '0')}-01`;
      
      // Calculate last day of month
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const endDate = `${year}-${monthNum.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const tasks = await Task.query()
        .where('user_id', userId)
        .whereRaw('DATE(due_date) >= ?', [startDate])
        .whereRaw('DATE(due_date) <= ?', [endDate])
        .orderBy('due_date', 'asc');

      return tasks;
    } catch (error) {
      logger.error('Tasks by month retrieval error:', error);
      throw error;
    }
  }

  async duplicateDaySchedule(userId: number, sourceDate: string, targetDate: string): Promise<Task[]> {
    try {
      logger.info(`Duplicating schedule from ${sourceDate} to ${targetDate} for user ${userId}`);
      
      // Normalize dates to YYYY-MM-DD format
      const normalizedSourceDate = sourceDate.split('T')[0];
      const normalizedTargetDate = targetDate.split('T')[0];
      
      logger.info(`Normalized dates - source: ${normalizedSourceDate}, target: ${normalizedTargetDate}`);
      
      // Get all tasks from source date
      const sourceTasks = await Task.query()
        .where('user_id', userId)
        .whereRaw('DATE(due_date) = ?', [normalizedSourceDate])
        .orderBy('due_time', 'asc');

      logger.info(`Found ${sourceTasks.length} tasks on source date`);

      if (sourceTasks.length === 0) {
        logger.info(`No tasks found for source date: ${normalizedSourceDate}`);
        return [];
      }

      // Create duplicates for target date
      const duplicatedTasks: Task[] = [];
      
      for (const sourceTask of sourceTasks) {
        logger.info(`Duplicating task: ${sourceTask.title}`);
        
        const newTask = await Task.query().insert({
          user_id: userId,
          title: sourceTask.title,
          description: sourceTask.description || null,
          due_date: normalizedTargetDate,
          due_time: sourceTask.due_time || null,
          end_time: sourceTask.end_time || null,
          priority: sourceTask.priority,
          is_critical: Boolean(sourceTask.is_critical),
          is_completed: false,
          display_order: sourceTask.display_order || 0,
        } as any);
        
        logger.info(`Created duplicate task with ID: ${newTask.id}`);
        duplicatedTasks.push(newTask);
      }

      logger.info(`Successfully duplicated ${duplicatedTasks.length} tasks from ${normalizedSourceDate} to ${normalizedTargetDate}`);
      return duplicatedTasks;
    } catch (error) {
      logger.error('Duplicate day schedule error:', error);
      throw error;
    }
  }
}

export default new TaskService();
