import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface AgentUIEffects {
  refreshTasks?: boolean;
  refreshAnalytics?: boolean;
  refreshProfile?: boolean;
  refreshPreferences?: boolean;
  affectedDates?: string[];
  theme?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgentSyncService {
  private readonly effectsSubject = new Subject<AgentUIEffects>();

  get effects$(): Observable<AgentUIEffects> {
    return this.effectsSubject.asObservable();
  }

  publish(effects?: AgentUIEffects): void {
    if (!effects) {
      return;
    }

    this.effectsSubject.next(effects);
  }
}
