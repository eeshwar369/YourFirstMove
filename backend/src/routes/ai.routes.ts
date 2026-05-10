import { Router } from 'express';
import aiAgentService from '../services/AIAgentService';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../config/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Store conversation history in memory (in production, use Redis or database)
const conversationStore = new Map<number, any[]>();

/**
 * Check if AI service is available
 */
router.get('/status', (req: AuthRequest, res) => {
  const isAvailable = aiAgentService.isAvailable();
  const providers = aiAgentService.getAvailableProviders();
  const providerStatus = aiAgentService.getProviderStatus();

  res.json({
    success: true,
    data: {
      available: isAvailable,
      providers,
      providerStatus,
      defaultProvider: aiAgentService.getDefaultProvider(),
      message: isAvailable
        ? 'AI Agent is ready to assist you'
        : 'AI Agent is not configured. Please add OPENAI_API_KEY or ANTHROPIC_API_KEY to environment variables.',
    },
  });
});

/**
 * Send message to AI agent
 */
router.post('/chat', async (req: AuthRequest, res, next) => {
  try {
    const { message, provider = 'auto' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Message is required and must be a string' },
      });
    }

    if (!aiAgentService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'AI Agent is not available. Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY.',
        },
      });
    }

    // Get conversation history for this user
    const userId = req.userId!;
    const conversationHistory = conversationStore.get(userId) || [];

    // Process message with AI agent
    const response = await aiAgentService.processMessage(
      userId,
      message,
      conversationHistory,
      provider
    );

    // Update conversation history
    conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response.message }
    );

    // Keep only last 20 messages to avoid token limits
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }

    conversationStore.set(userId, conversationHistory);

    logger.info(`AI Agent response for user ${userId}`, {
      actions: response.actions,
      success: response.success,
      provider: response.provider,
    });

    const statusCode = response.success ? 200 : 500;

    res.status(statusCode).json({
      success: response.success,
      data: {
        message: response.message,
        actions: response.actions || [],
        actionData: response.data,
        provider: response.provider,
        uiEffects: response.uiEffects,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('AI chat error:', error);
    next(error);
  }
});

/**
 * Clear conversation history
 */
router.delete('/conversation', (req: AuthRequest, res) => {
  const userId = req.userId!;
  conversationStore.delete(userId);

  res.json({
    success: true,
    message: 'Conversation history cleared',
  });
});

/**
 * Get conversation history
 */
router.get('/conversation', (req: AuthRequest, res) => {
  const userId = req.userId!;
  const history = conversationStore.get(userId) || [];

  res.json({
    success: true,
    data: {
      messages: history,
      count: history.length,
    },
  });
});

/**
 * Get AI suggestions based on current tasks
 */
router.get('/suggestions', async (req: AuthRequest, res, next) => {
  try {
    if (!aiAgentService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: { message: 'AI Agent is not available' },
      });
    }

    const userId = req.userId!;
    const today = new Date().toISOString().split('T')[0];

    // Get today's tasks to provide context
    const prompt = `Analyze my tasks for today (${today}) and provide 3-5 actionable productivity suggestions. Focus on prioritization, time management, and task completion strategies.`;

    const response = await aiAgentService.processMessage(userId, prompt, [], 'auto');

    res.json({
      success: true,
      data: {
        suggestions: response.message,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('AI suggestions error:', error);
    next(error);
  }
});

export default router;
