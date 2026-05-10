import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import {
  AiAssistantService,
  AIStatus,
} from '../../core/services/ai-assistant.service';
import { Theme, ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: string[];
  actionData?: unknown;
}

@Component({
  selector: 'app-ai-assistant',
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.scss']
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: Message[] = [];
  userInput = '';
  isLoading = false;
  aiStatus: AIStatus | null = null;
  isOpen = false;
  selectedProvider: 'auto' | 'openai' | 'anthropic' = 'auto';

  private shouldScrollToBottom = false;

  constructor(
    private aiAssistantService: AiAssistantService,
    private themeService: ThemeService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.checkAIStatus();
    this.loadConversationHistory();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  checkAIStatus(): void {
    this.aiAssistantService.getStatus().subscribe({
      next: (response) => {
        this.aiStatus = response.data;
        this.selectedProvider = 'auto';

        if (this.aiStatus.available && this.messages.length === 0) {
          this.addAssistantMessage(
            "Hi! I'm your AI productivity assistant. I can help with tasks, schedules, analytics, profile updates, and preferences."
          );
        }
      },
      error: (error) => {
        console.error('Failed to check AI status:', error);
      }
    });
  }

  loadConversationHistory(): void {
    this.aiAssistantService.getConversation().subscribe({
      next: (response) => {
        if (response.data.messages.length > 0) {
          this.messages = response.data.messages.map((message) => ({
            role: message.role,
            content: message.content,
            timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
          }));
          this.shouldScrollToBottom = true;
        }
      },
      error: (error) => {
        console.error('Failed to load conversation history:', error);
      }
    });
  }

  sendMessage(): void {
    if (!this.userInput.trim() || this.isLoading || !this.aiStatus?.available) {
      return;
    }

    const userMessage = this.userInput.trim();
    this.userInput = '';

    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    this.isLoading = true;
    this.shouldScrollToBottom = true;

    this.aiAssistantService.sendMessage(userMessage, this.selectedProvider).subscribe({
      next: (response) => {
        if (response.data.uiEffects?.theme) {
          this.themeService.setTheme(response.data.uiEffects.theme as Theme);
        }

        if (response.data.uiEffects?.refreshProfile) {
          this.userService.getProfile().subscribe();
        }

        this.addAssistantMessage(
          response.data.message,
          response.data.actions,
          response.data.actionData
        );
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('AI chat error:', error);
        this.addAssistantMessage(
          'I ran into an error while processing that request. Please try again.'
        );
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      }
    });
  }

  clearConversation(): void {
    if (!confirm('Are you sure you want to clear the conversation history?')) {
      return;
    }

    this.aiAssistantService.clearConversation().subscribe({
      next: () => {
        this.messages = [];
        this.addAssistantMessage('Conversation cleared. What would you like to do next?');
      },
      error: (error) => {
        console.error('Failed to clear conversation:', error);
      }
    });
  }

  getSuggestions(): void {
    this.isLoading = true;

    this.aiAssistantService.getSuggestions().subscribe({
      next: (response) => {
        this.addAssistantMessage(response.data.suggestions);
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('Failed to get suggestions:', error);
        this.isLoading = false;
      }
    });
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      this.shouldScrollToBottom = true;
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  quickAction(action: string): void {
    const actions: Record<string, string> = {
      today: 'Show me my tasks for today',
      create: 'Create a task for tomorrow at 09:00 called Planning Session',
      analytics: 'Show me my productivity analytics for this week',
      suggestions: 'Give me productivity suggestions based on my current workload',
    };

    this.userInput = actions[action] || '';
    this.sendMessage();
  }

  private addAssistantMessage(content: string, actions?: string[], actionData?: unknown): void {
    this.messages.push({
      role: 'assistant',
      content,
      timestamp: new Date(),
      actions,
      actionData,
    });
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (error) {
      console.error('Scroll error:', error);
    }
  }
}
