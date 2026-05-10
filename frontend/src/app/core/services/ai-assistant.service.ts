import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AgentSyncService, AgentUIEffects } from './agent-sync.service';

export interface AIProviderStatus {
  name: 'openai' | 'anthropic';
  model: string;
}

export interface AIStatus {
  available: boolean;
  providers: Array<'openai' | 'anthropic'>;
  providerStatus: AIProviderStatus[];
  defaultProvider: 'openai' | 'anthropic' | null;
  message: string;
}

export interface AIConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | Date;
}

export interface AIChatResponseData {
  message: string;
  actions: string[];
  actionData?: unknown;
  provider?: 'openai' | 'anthropic';
  uiEffects?: AgentUIEffects;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private readonly apiUrl = `${environment.apiUrl}/ai`;

  constructor(
    private http: HttpClient,
    private agentSyncService: AgentSyncService
  ) {}

  getStatus(): Observable<{ success: boolean; data: AIStatus }> {
    return this.http.get<{ success: boolean; data: AIStatus }>(`${this.apiUrl}/status`);
  }

  getConversation(): Observable<{ success: boolean; data: { messages: AIConversationMessage[]; count: number } }> {
    return this.http.get<{ success: boolean; data: { messages: AIConversationMessage[]; count: number } }>(
      `${this.apiUrl}/conversation`
    );
  }

  sendMessage(
    message: string,
    provider: 'auto' | 'openai' | 'anthropic'
  ): Observable<{ success: boolean; data: AIChatResponseData }> {
    return this.http
      .post<{ success: boolean; data: AIChatResponseData }>(`${this.apiUrl}/chat`, {
        message,
        provider,
      })
      .pipe(
        tap((response) => this.agentSyncService.publish(response.data.uiEffects))
      );
  }

  clearConversation(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/conversation`);
  }

  getSuggestions(): Observable<{ success: boolean; data: { suggestions: string; timestamp: string } }> {
    return this.http.get<{ success: boolean; data: { suggestions: string; timestamp: string } }>(
      `${this.apiUrl}/suggestions`
    );
  }
}
