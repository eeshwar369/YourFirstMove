import { Router } from 'express';
import taskService from '../services/TaskService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate, createTaskSchema, updateTaskSchema } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List tasks
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const filters = {
      priority: req.query.priority as string,
      isCompleted: req.query.isCompleted === 'true',
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      search: req.query.search as string,
    };

    const pagination = {
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 50,
    };

    const result = await taskService.listTasks(req.userId!, filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Create task
router.post('/', validate(createTaskSchema), async (req: AuthRequest, res, next) => {
  try {
    const task = await taskService.createTask(req.userId!, req.body);

    res.status(201).json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// Get single task
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const task = await taskService.getTask(parseInt(req.params.id), req.userId!);

    res.json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// Update task
router.put('/:id', validate(updateTaskSchema), async (req: AuthRequest, res, next) => {
  try {
    const task = await taskService.updateTask(parseInt(req.params.id), req.userId!, req.body);

    res.json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// Delete task
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await taskService.deleteTask(parseInt(req.params.id), req.userId!);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Mark task complete
router.patch('/:id/complete', async (req: AuthRequest, res, next) => {
  try {
    const task = await taskService.markComplete(parseInt(req.params.id), req.userId!);

    res.json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// Mark task incomplete
router.patch('/:id/uncomplete', async (req: AuthRequest, res, next) => {
  try {
    const task = await taskService.markIncomplete(parseInt(req.params.id), req.userId!);

    res.json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// Reorder tasks
router.patch('/reorder', async (req: AuthRequest, res, next) => {
  try {
    await taskService.reorderTasks(req.userId!, req.body.taskIds);

    res.json({
      success: true,
      message: 'Tasks reordered successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Get tasks by date
router.get('/daily/:date', async (req: AuthRequest, res, next) => {
  try {
    const tasks = await taskService.getTasksByDate(req.userId!, req.params.date);

    res.json({
      success: true,
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
});

// Get tasks by month
router.get('/monthly/:month', async (req: AuthRequest, res, next) => {
  try {
    const tasks = await taskService.getTasksByMonth(req.userId!, req.params.month);

    res.json({
      success: true,
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
});

// Duplicate day's schedule to another date
router.post('/duplicate-day', async (req: AuthRequest, res, next) => {
  try {
    const { sourceDate, targetDate } = req.body;
    
    if (!sourceDate || !targetDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'sourceDate and targetDate are required' }
      });
    }
    
    const duplicatedTasks = await taskService.duplicateDaySchedule(
      req.userId!,
      sourceDate,
      targetDate
    );

    res.json({
      success: true,
      data: { tasks: duplicatedTasks, count: duplicatedTasks.length },
      message: `Successfully duplicated ${duplicatedTasks.length} tasks`
    });
  } catch (error) {
    next(error);
  }
});
// Get dead-air gaps and micro-task suggestions
router.get('/analytics/gaps/:date', async (req: AuthRequest, res, next) => {
  try {
    const gapAnalysis = await taskService.getScheduleGaps(req.userId!, req.params.date);

    res.json({
      success: true,
      data: gapAnalysis,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
