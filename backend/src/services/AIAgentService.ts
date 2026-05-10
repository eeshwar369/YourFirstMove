import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import taskService from './TaskService';
import analyticsService from './AnalyticsService';
import User from '../models/User';
import UserPreference from '../models/UserPreference';
import logger from '../config/logger';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentUIEffects {
  refreshTasks?: boolean;
  refreshAnalytics?: boolean;
  refreshProfile?: boolean;
  refreshPreferences?: boolean;
  affectedDates?: string[];
  theme?: string;
}

export interface AIResponse {
  message: string;
  data?: unknown;
  actions?: string[];
  provider?: 'openai' | 'anthropic';
  uiEffects?: AgentUIEffects;
  success: boolean;
}

type AIProvider = 'openai' | 'anthropic';

interface ExecutedTool {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (userId: number, args: Record<string, any>) => Promise<unknown>;
}

export interface AIProviderStatus {
  name: AIProvider;
  model: string;
}

export class AIAgentService {
  private readonly openai: OpenAI | null;
  private readonly anthropic: Anthropic | null;
  private readonly openaiModel: string;
  private readonly anthropicModel: string;
  private readonly defaultProvider: AIProvider;
  private readonly maxToolRounds = 6;

  constructor() {
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
    this.anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;

    this.anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;

    const configuredDefault = process.env.AI_DEFAULT_PROVIDER as AIProvider | undefined;
    this.defaultProvider =
      configuredDefault && this.isProviderConfigured(configuredDefault)
        ? configuredDefault
        : this.openai
          ? 'openai'
          : 'anthropic';

    if (this.openai) {
      logger.info(`OpenAI initialized for AI Agent using model ${this.openaiModel}`);
    }

    if (this.anthropic) {
      logger.info(`Anthropic initialized for AI Agent using model ${this.anthropicModel}`);
    }

    if (!this.openai && !this.anthropic) {
      logger.warn('No AI provider configured. AI Agent will not be available.');
    }
  }

  async processMessage(
    userId: number,
    userMessage: string,
    conversationHistory: AIMessage[] = [],
    provider: AIProvider | 'auto' = 'auto'
  ): Promise<AIResponse> {
    try {
      const selectedProvider = this.selectProvider(provider);

      if (selectedProvider === 'openai') {
        return await this.processWithOpenAI(userId, userMessage, conversationHistory);
      }

      return await this.processWithAnthropic(userId, userMessage, conversationHistory);
    } catch (error) {
      logger.error('AI Agent processing error:', error);

      return {
        message: 'I ran into an error while processing that request. Please try again.',
        success: false,
      };
    }
  }

  isAvailable(): boolean {
    return this.openai !== null || this.anthropic !== null;
  }

  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];

    if (this.openai) {
      providers.push('openai');
    }

    if (this.anthropic) {
      providers.push('anthropic');
    }

    return providers;
  }

  getProviderStatus(): AIProviderStatus[] {
    const providers: AIProviderStatus[] = [];

    if (this.openai) {
      providers.push({ name: 'openai', model: this.openaiModel });
    }

    if (this.anthropic) {
      providers.push({ name: 'anthropic', model: this.anthropicModel });
    }

    return providers;
  }

  getDefaultProvider(): AIProvider | null {
    return this.isProviderConfigured(this.defaultProvider) ? this.defaultProvider : null;
  }

  private async processWithOpenAI(
    userId: number,
    userMessage: string,
    conversationHistory: AIMessage[]
  ): Promise<AIResponse> {
    if (!this.openai) {
      throw new Error('OpenAI is not configured');
    }

    const tools = this.getTools();
    const openAITools = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    const messages: any[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...conversationHistory.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const executedTools: ExecutedTool[] = [];

    for (let round = 0; round < this.maxToolRounds; round += 1) {
      const response = await this.openai.chat.completions.create({
        model: this.openaiModel,
        messages,
        tools: openAITools,
        tool_choice: 'auto',
        temperature: 0.2,
      });

      const assistantMessage = response.choices[0]?.message;

      if (!assistantMessage) {
        break;
      }

      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return this.buildResponse(
          assistantMessage.content || 'I can help with that.',
          executedTools,
          'openai'
        );
      }

      for (const toolCall of assistantMessage.tool_calls) {
        const args = this.parseToolArguments(toolCall.function.arguments);
        const result = await this.executeTool(toolCall.function.name, userId, args);

        executedTools.push({
          name: toolCall.function.name,
          args,
          result,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    return this.buildResponse(
      'I completed the requested actions, but I hit the tool loop limit before composing a final summary.',
      executedTools,
      'openai'
    );
  }

  private async processWithAnthropic(
    userId: number,
    userMessage: string,
    conversationHistory: AIMessage[]
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic is not configured');
    }

    const tools = this.getTools();
    const anthropicTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    const messages: any[] = [
      ...conversationHistory.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const executedTools: ExecutedTool[] = [];

    for (let round = 0; round < this.maxToolRounds; round += 1) {
      const response = await this.anthropic.messages.create({
        model: this.anthropicModel,
        max_tokens: 2048,
        temperature: 0.2,
        system: this.getSystemPrompt(),
        messages,
        tools: anthropicTools,
      });

      messages.push({
        role: 'assistant',
        content: response.content,
      });

      const toolUses = response.content.filter((block: any) => block.type === 'tool_use');

      if (toolUses.length === 0) {
        const text = response.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n\n')
          .trim();

        return this.buildResponse(text || 'I can help with that.', executedTools, 'anthropic');
      }

      const toolResults: any[] = [];

      for (const toolUse of toolUses) {
        const args = (toolUse.input || {}) as Record<string, unknown>;
        const result = await this.executeTool(toolUse.name, userId, args);

        executedTools.push({
          name: toolUse.name,
          args,
          result,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    return this.buildResponse(
      'I completed the requested actions, but I hit the tool loop limit before composing a final summary.',
      executedTools,
      'anthropic'
    );
  }

  private getSystemPrompt(): string {
    const today = new Date().toISOString().split('T')[0];

    return `You are the YourFirstMove productivity copilot.

Your job is to help users perform the same work they can do in the UI:
- manage tasks and schedules
- inspect daily and monthly plans
- view analytics and streaks
- update profile details and user preferences

Behavior rules:
- Be concise, helpful, and action oriented.
- If the user asks you to do something in the app, prefer using tools instead of giving manual instructions.
- Use multiple tools when needed to fully complete the request.
- If the user refers to a task without an id, use list/search tools first to identify the correct task.
- For destructive actions, double-check intent from the conversation. If intent is already explicit, proceed.
- When you finish a tool action, summarize what changed and call out any important dates.
- Dates must be normalized as YYYY-MM-DD.
- Times must be normalized as HH:MM in 24-hour format.
- "today" means ${today}.
- Supported priorities are low, medium, high, and critical.
- Theme values are light, dark, and custom.

If a request falls outside the available tools, say that clearly and offer the closest supported help.`;
  }

  private getTools(): AgentTool[] {
    return [
      {
        name: 'list_tasks',
        description: 'List tasks with optional date, status, priority, or search filters.',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            dateTo: { type: 'string', description: 'End date in YYYY-MM-DD format' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            isCompleted: { type: 'boolean' },
            search: { type: 'string', description: 'Search term for task title or description' },
            page: { type: 'integer', minimum: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
        execute: async (userId, args) =>
          taskService.listTasks(
            userId,
            {
              dateFrom: args.dateFrom,
              dateTo: args.dateTo,
              priority: args.priority,
              isCompleted: args.isCompleted,
              search: args.search,
            },
            {
              page: this.toNumber(args.page, 1),
              pageSize: this.toNumber(args.pageSize, 50),
            }
          ),
      },
      {
        name: 'get_tasks_by_date',
        description: 'Get all tasks for a specific day.',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          },
          required: ['date'],
        },
        execute: async (userId, args) => {
          const tasks = await taskService.getTasksByDate(userId, args.date);
          return { tasks, count: tasks.length, date: args.date };
        },
      },
      {
        name: 'get_tasks_by_month',
        description: 'Get all tasks for a specific month as shown in the monthly calendar.',
        inputSchema: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Month in YYYY-MM format' },
          },
          required: ['month'],
        },
        execute: async (userId, args) => {
          const tasks = await taskService.getTasksByMonth(userId, args.month);
          return { tasks, count: tasks.length, month: args.month };
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
            dueTime: { type: 'string', description: 'Start time in HH:MM format' },
            endTime: { type: 'string', description: 'End time in HH:MM format' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            isCritical: { type: 'boolean' },
          },
          required: ['title'],
        },
        execute: async (userId, args) => taskService.createTask(userId, args as any),
      },
      {
        name: 'update_task',
        description: 'Update fields on an existing task.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string' },
            dueDate: { type: 'string' },
            dueTime: { type: 'string' },
            endTime: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            isCritical: { type: 'boolean' },
            isCompleted: { type: 'boolean' },
          },
          required: ['taskId'],
        },
        execute: async (userId, args) => {
          const { taskId, ...updates } = args;
          return taskService.updateTask(this.toNumber(taskId), userId, updates);
        },
      },
      {
        name: 'delete_task',
        description: 'Delete a task permanently.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'integer' },
          },
          required: ['taskId'],
        },
        execute: async (userId, args) => {
          await taskService.deleteTask(this.toNumber(args.taskId), userId);
          return { success: true, deletedTaskId: this.toNumber(args.taskId) };
        },
      },
      {
        name: 'mark_task_complete',
        description: 'Mark a task as completed.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'integer' },
          },
          required: ['taskId'],
        },
        execute: async (userId, args) => taskService.markComplete(this.toNumber(args.taskId), userId),
      },
      {
        name: 'mark_task_incomplete',
        description: 'Mark a task as incomplete.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'integer' },
          },
          required: ['taskId'],
        },
        execute: async (userId, args) => taskService.markIncomplete(this.toNumber(args.taskId), userId),
      },
      {
        name: 'duplicate_schedule',
        description: 'Duplicate all tasks from one date to another.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceDate: { type: 'string', description: 'Source date in YYYY-MM-DD format' },
            targetDate: { type: 'string', description: 'Target date in YYYY-MM-DD format' },
          },
          required: ['sourceDate', 'targetDate'],
        },
        execute: async (userId, args) => {
          const tasks = await taskService.duplicateDaySchedule(userId, args.sourceDate, args.targetDate);
          return {
            tasks,
            count: tasks.length,
            sourceDate: args.sourceDate,
            targetDate: args.targetDate,
          };
        },
      },
      {
        name: 'reorder_tasks',
        description: 'Apply a new display order for a set of task ids.',
        inputSchema: {
          type: 'object',
          properties: {
            taskIds: {
              type: 'array',
              items: { type: 'integer' },
            },
          },
          required: ['taskIds'],
        },
        execute: async (userId, args) => {
          const taskIds = Array.isArray(args.taskIds)
            ? args.taskIds.map((taskId) => this.toNumber(taskId)).filter((taskId) => taskId > 0)
            : [];
          await taskService.reorderTasks(userId, taskIds);
          return { success: true, taskIds };
        },
      },
      {
        name: 'get_completion_rate',
        description: 'Get completion rate analytics for a date range.',
        inputSchema: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            dateTo: { type: 'string', description: 'End date in YYYY-MM-DD format' },
          },
        },
        execute: async (userId, args) => {
          const dateFrom = args.dateFrom || new Date().toISOString().split('T')[0];
          const dateTo = args.dateTo || dateFrom;
          return analyticsService.calculateCompletionRate(userId, dateFrom, dateTo);
        },
      },
      {
        name: 'get_productivity_trends',
        description: 'Get productivity trends for week, month, quarter, or year.',
        inputSchema: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['week', 'month', 'quarter', 'year'] },
          },
        },
        execute: async (userId, args) => analyticsService.getProductivityTrends(userId, args.period || 'week'),
      },
      {
        name: 'get_streak',
        description: 'Get the user productivity streak.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async (userId) => {
          const currentStreak = await analyticsService.calculateStreak(userId);
          return { currentStreak };
        },
      },
      {
        name: 'get_task_statistics',
        description: 'Get high level task statistics from the analytics dashboard.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async (userId) => analyticsService.getTaskStatistics(userId),
      },
      {
        name: 'get_profile',
        description: 'Get the current user profile.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async (userId) => User.query().findById(userId),
      },
      {
        name: 'update_profile',
        description: 'Update the current user profile.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phoneNumber: { type: 'string' },
          },
        },
        execute: async (userId, args) =>
          User.query().patchAndFetchById(
            userId,
            this.removeUndefined({
              name: args.name,
              phone_number: args.phoneNumber,
            })
          ),
      },
      {
        name: 'get_preferences',
        description: 'Get current user preferences.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async (userId) => this.getOrCreateUserPreferences(userId),
      },
      {
        name: 'update_preferences',
        description: 'Update user preferences such as theme and notification settings.',
        inputSchema: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark', 'custom'] },
            notification_enabled: { type: 'boolean' },
            notification_timing: { type: 'integer', minimum: 5, maximum: 120 },
          },
        },
        execute: async (userId, args) => {
          const preferences = await this.getOrCreateUserPreferences(userId);
          return preferences.$query().patchAndFetch(this.removeUndefined(args));
        },
      },
    ];
  }

  private async executeTool(
    name: string,
    userId: number,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.getTools().find((candidate) => candidate.name === name);

    if (!tool) {
      throw new Error(`Unknown AI tool: ${name}`);
    }

    logger.info(`Executing AI tool ${name} for user ${userId}`, args);
    return tool.execute(userId, args);
  }

  private buildResponse(
    message: string,
    executedTools: ExecutedTool[],
    provider: AIProvider
  ): AIResponse {
    return {
      message,
      data: executedTools.length > 0 ? { toolResults: executedTools } : undefined,
      actions: executedTools.map((tool) => tool.name),
      provider,
      uiEffects: this.buildUIEffects(executedTools),
      success: true,
    };
  }

  private buildUIEffects(executedTools: ExecutedTool[]): AgentUIEffects | undefined {
    if (executedTools.length === 0) {
      return undefined;
    }

    const mutationTools = new Set([
      'create_task',
      'update_task',
      'delete_task',
      'mark_task_complete',
      'mark_task_incomplete',
      'duplicate_schedule',
      'reorder_tasks',
    ]);

    const affectedDates = new Set<string>();
    let refreshTasks = false;
    let refreshAnalytics = false;
    let refreshProfile = false;
    let refreshPreferences = false;
    let theme: string | undefined;

    for (const tool of executedTools) {
      if (mutationTools.has(tool.name)) {
        refreshTasks = true;
        refreshAnalytics = true;
      }

      if (tool.name === 'update_profile') {
        refreshProfile = true;
      }

      if (tool.name === 'update_preferences') {
        refreshPreferences = true;
        const updatedTheme = this.readString((tool.result as Record<string, unknown>)?.theme);

        if (updatedTheme) {
          theme = updatedTheme;
        }
      }

      const candidateDates = [
        this.readString(tool.args.dueDate),
        this.readString(tool.args.date),
        this.readString(tool.args.sourceDate),
        this.readString(tool.args.targetDate),
        this.readString((tool.result as Record<string, unknown>)?.due_date),
      ];

      for (const candidate of candidateDates) {
        if (candidate) {
          affectedDates.add(candidate);
        }
      }

      const resultTasks = (tool.result as Record<string, unknown>)?.tasks;

      if (Array.isArray(resultTasks)) {
        for (const task of resultTasks) {
          const dueDate = this.readString((task as Record<string, unknown>).due_date);

          if (dueDate) {
            affectedDates.add(dueDate);
          }
        }
      }
    }

    return {
      refreshTasks,
      refreshAnalytics,
      refreshProfile,
      refreshPreferences,
      affectedDates: affectedDates.size > 0 ? Array.from(affectedDates) : undefined,
      theme,
    };
  }

  private async getOrCreateUserPreferences(userId: number) {
    let preferences = await UserPreference.query().findOne({ user_id: userId });

    if (!preferences) {
      preferences = await UserPreference.query().insert({
        user_id: userId,
        theme: 'light',
        notification_enabled: true,
        notification_timing: 30,
      });
    }

    return preferences;
  }

  private selectProvider(provider: AIProvider | 'auto'): AIProvider {
    if (provider === 'auto') {
      if (!this.isProviderConfigured(this.defaultProvider)) {
        throw new Error('No AI provider is configured');
      }

      return this.defaultProvider;
    }

    if (!this.isProviderConfigured(provider)) {
      throw new Error(`${provider} is not configured`);
    }

    return provider;
  }

  private isProviderConfigured(provider: AIProvider): boolean {
    return provider === 'openai' ? this.openai !== null : this.anthropic !== null;
  }

  private parseToolArguments(rawArguments: string): Record<string, unknown> {
    if (!rawArguments) {
      return {};
    }

    try {
      return JSON.parse(rawArguments);
    } catch (error) {
      logger.warn('Failed to parse tool arguments as JSON', { rawArguments, error });
      return {};
    }
  }

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private removeUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as T;
  }
}

export default new AIAgentService();
