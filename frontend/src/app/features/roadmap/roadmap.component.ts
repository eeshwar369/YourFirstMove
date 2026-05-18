import { Component, OnInit } from '@angular/core';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';
import { TaskService } from '../../core/services/task.service'; 
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-roadmap',
  templateUrl: './roadmap.component.html',
  styleUrls: ['./roadmap.component.css'],
  animations: [
    // Defining the "Elastic Bump" structural trigger for conflict feedback
    trigger('elasticBump', [
      transition('idle => bump', [
        animate('450ms ease-in-out', keyframes([
          style({ transform: 'translateX(0)', offset: 0 }),
          style({ transform: 'translateX(-12px)', offset: 0.15 }),
          style({ transform: 'translateX(10px)', offset: 0.30 }),
          style({ transform: 'translateX(-6px)', offset: 0.45 }),
          style({ transform: 'translateX(4px)', offset: 0.70 }),
          style({ transform: 'translateX(0)', offset: 1.0 })
        ]))
      ])
    ])
  ]
})
export class RoadmapComponent implements OnInit {
  managedTimelineTasks: any[] = [];
  discoveredTimelineGaps: any[] = [];
  
  tasks: any[] = []; 
  selectedDate: string = new Date().toISOString().split('T')[0]; 
  loading: boolean = false;
  viewMode: 'timeline' | 'list' = 'timeline';
  completionPercentage: number = 0;
  completingTaskId: number | null = null;
  showDuplicateDialog: boolean = false;
  duplicating: boolean = false;
  duplicateSourceDate: string = '';
  duplicateTargetDate: string = '';

  constructor(private taskService: TaskService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadDailyTimelineStructure();
  }

  loadDailyTimelineStructure(): void {
    this.loading = true;

    this.taskService.getTasksByDate(this.selectedDate).subscribe({
      next: (response: any) => {

        const tasksData = response.data?.tasks || response.data || [];
        this.tasks = tasksData;

        this.managedTimelineTasks = tasksData.map((t: any) => ({
          ...t,
          animationState: 'idle'
        }));
        
        this.calculateProgressMetrics();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    this.taskService.getScheduleGaps(this.selectedDate).subscribe({
      next: (response: any) => {
        this.discoveredTimelineGaps = response.data?.gaps || response.gaps || [];
      }
    });
  }

  onDateChange(): void {
    this.loadDailyTimelineStructure();
  }

  fetchRowPosition(timeStr: string): number {
    if (!timeStr) return 1;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60 + minutes) + 1;
  }


  executeTimeUpdate(taskItem: any, newStart: string, newEnd: string): void {
    const backupStart = taskItem.due_time;
    const backupEnd = taskItem.end_time;

    taskItem.due_time = newStart;
    taskItem.end_time = newEnd;

    this.taskService.updateTask(taskItem.id, taskItem).subscribe({
      next: () => {
        this.snackBar.open('Schedule seamlessly optimized!', 'Dismiss', { duration: 3000 });
        this.loadDailyTimelineStructure(); 
      },
      error: (err) => {
        taskItem.due_time = backupStart;
        taskItem.end_time = backupEnd;

        taskItem.animationState = 'bump';

        const userFriendlyNotice = err.error?.message || "Time slot intersection conflict encountered.";
        this.snackBar.open(userFriendlyNotice, 'Got it', { duration: 5000 });

        setTimeout(() => {
          taskItem.animationState = 'idle';
        }, 460);
      }
    });
  }

  calculateProgressMetrics(): void {
    if (this.tasks.length === 0) {
      this.completionPercentage = 0;
      return;
    }
    const completed = this.tasks.filter(t => t.is_completed).length;
    this.completionPercentage = Math.round((completed / this.tasks.length) * 100);
  }

  getCompletedCount(): number {
    return this.tasks.filter(t => t.is_completed).length;
  }

  getUnscheduledTasks(): any[] {
    return this.tasks.filter(t => !t.due_time);
  }

  setViewMode(mode: 'timeline' | 'list'): void {
    this.viewMode = mode;
  }

  isTimelineView(): boolean {
    return this.viewMode === 'timeline';
  }

  isListView(): boolean {
    return this.viewMode === 'list';
  }

  openDuplicateDialog(): void { this.showDuplicateDialog = true; }
  closeDuplicateDialog(): void { this.showDuplicateDialog = false; }
  openTaskDialog(task?: any): void { /* Triggers your task modal logic */ }
  
  getPriorityBorderClass(priority: string): string {
    switch (priority) {
      case 'critical': return 'border-l-4 border-red-600';
      case 'high': return 'border-l-4 border-orange-500';
      case 'medium': return 'border-l-4 border-amber-500';
      default: return 'border-l-4 border-slate-400';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  }

  toggleComplete(task: any): void {
    const originalState = task.is_completed;
    task.is_completed = !task.is_completed;
    
    this.taskService.updateTask(task.id, task).subscribe({
      next: () => {
        this.snackBar.open(task.is_completed ? 'Task completed!' : 'Task marked incomplete.', 'Dismiss', { duration: 2500 });
        this.loadDailyTimelineStructure();
      },
      error: () => {
        task.is_completed = originalState; // Rollover fallback protection if update pipeline snaps
        this.snackBar.open('Failed to update task completion state.', 'Close', { duration: 3000 });
      }
    });
  }

  deleteTask(task: any, event: Event): void {
    event.stopPropagation(); 
    
    if (confirm(`Are you sure you want to remove "${task.title}"?`)) {
      this.taskService.deleteTask(task.id).subscribe({
        next: () => {
          this.snackBar.open('Task dropped from schedule.', 'Dismiss', { duration: 3000 });
          this.loadDailyTimelineStructure();
        }
      });
    }
  }


  drop(event: any): void {
    // Basic drag drop index arrangement logic wrapper
    if (event.previousIndex !== event.currentIndex) {
      this.snackBar.open('Reordering layout index positions...', 'Dismiss', { duration: 1500 });
    }
  }

  duplicateSchedule(): void {
    if (!this.duplicateSourceDate || !this.duplicateTargetDate) return;
    
    this.duplicating = true;
    this.taskService.duplicateDaySchedule(this.duplicateSourceDate, this.duplicateTargetDate).subscribe({
      next: () => {
        this.snackBar.open('Schedule structure duplicated successfully!', 'Great', { duration: 3000 });
        this.showDuplicateDialog = false;
        this.duplicating = false;
        this.loadDailyTimelineStructure();
      },
      error: (err) => {
        this.duplicating = false;
        const fallbackMsg = err.error?.message || "Failed to duplicate calendar blocks.";
        this.snackBar.open(fallbackMsg, 'Close', { duration: 4000 });
      }
    });
  }
}