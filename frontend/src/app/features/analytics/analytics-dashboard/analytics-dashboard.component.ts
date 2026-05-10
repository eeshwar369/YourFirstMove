import { Component, OnInit, OnDestroy } from '@angular/core';
import { AnalyticsService, CompletionRate, TaskStatistics } from '../../../core/services/analytics.service';
import { Subscription } from 'rxjs';
import { AgentSyncService } from '../../../core/services/agent-sync.service';

@Component({
  selector: 'app-analytics-dashboard',
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss']
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  loading = false;
  completionRate: CompletionRate | null = null;
  statistics: TaskStatistics | null = null;
  currentStreak = 0;
  selectedPeriod = 'week';

  periods = [
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 90 Days' },
    { value: 'year', label: 'Last Year' }
  ];
  private syncSubscription?: Subscription;

  constructor(
    private analyticsService: AnalyticsService,
    private agentSyncService: AgentSyncService
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
    this.syncSubscription = this.agentSyncService.effects$.subscribe((effects) => {
      if (effects.refreshAnalytics) {
        this.loadAnalytics();
      }
    });
  }

  ngOnDestroy(): void {
    this.syncSubscription?.unsubscribe();
  }

  loadAnalytics(): void {
    this.loading = true;

    // Load completion rate
    this.analyticsService.getCompletionRate().subscribe({
      next: (response) => {
        this.completionRate = response.data;
      }
    });

    // Load statistics
    this.analyticsService.getTaskStatistics().subscribe({
      next: (response) => {
        this.statistics = response.data;
      }
    });

    // Load streak data
    this.analyticsService.getStreakData().subscribe({
      next: (response) => {
        this.currentStreak = response.data.currentStreak;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onPeriodChange(): void {
    this.loadAnalytics();
  }

  getCompletionColor(): string {
    if (!this.completionRate) return 'primary';
    if (this.completionRate.percentage >= 80) return 'accent';
    if (this.completionRate.percentage >= 50) return 'primary';
    return 'warn';
  }

  getStreakMessage(): string {
    if (this.currentStreak === 0) return 'Start your streak today!';
    if (this.currentStreak === 1) return 'Great start! Keep it going!';
    if (this.currentStreak < 7) return 'Building momentum!';
    if (this.currentStreak < 30) return 'Impressive streak!';
    return 'Amazing dedication!';
  }

  getStrokeColor(): string {
    if (!this.completionRate) return '#f44336';
    if (this.completionRate.percentage >= 80) return '#4caf50';
    if (this.completionRate.percentage >= 50) return '#ff9800';
    return '#f44336';
  }

  getStrokeDashoffset(): number {
    const circumference = 502.4;
    const percentage = this.completionRate?.percentage || 0;
    return circumference - (circumference * percentage / 100);
  }
}
