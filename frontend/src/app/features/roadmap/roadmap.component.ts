import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TaskService } from '../../core/services/task.service';
import { Task } from '../../core/models/task.model';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { TaskFormComponent } from '../tasks/task-form/task-form.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

interface TimeSlot {
  hour: number;
  displayTime: string;
  tasks: Task[];
}

interface TimelineTaskLayout extends Task {
  topPosition: number;
  height: number;
  startTime: string;
  endTime: string;
  startMinutes: number;
  durationMinutes: number;
  visualEndMinutes: number;
  column: number;
  totalColumns: number;
  columnSpan: number;
}

@Component({
  selector: 'app-roadmap',
  templateUrl: './roadmap.component.html',
  styleUrls: ['./roadmap.component.scss']
})
export class RoadmapComponent implements OnInit {
  private readonly PIXELS_PER_HOUR = 100;
  private readonly PIXELS_PER_MINUTE = this.PIXELS_PER_HOUR / 60;
  private readonly MIN_TASK_HEIGHT = 40;

  tasks: Task[] = [];
  loading = false;
  completingTaskId: number | null = null;
  selectedDate = new Date().toISOString().split('T')[0];
  completionPercentage = 0;
  viewMode = 'timeline' as string; // Explicit type assertion
  timeSlots: TimeSlot[] = [];
  currentTime = new Date();
  
  // Duplicate schedule state
  showDuplicateDialog = false;
  duplicateSourceDate = '';
  duplicateTargetDate = '';
  duplicating = false;

  constructor(
    private taskService: TaskService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    // Update current time every minute
    setInterval(() => {
      this.currentTime = new Date();
    }, 60000);
  }

  ngOnInit(): void {
    // Check for date query parameter
    this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.selectedDate = params['date'];
      }
      this.loadTasks();
    });
  }

  loadTasks(): void {
    this.loading = true;
    this.taskService.getTasksByDate(this.selectedDate).subscribe({
      next: (response) => {
        this.tasks = response.data.tasks;
        console.log('Loaded tasks:', this.tasks);
        this.tasks.forEach(task => {
          console.log(`Task: ${task.title}, due_time: ${task.due_time}, end_time: ${(task as any).end_time}`);
        });
        this.calculateCompletion();
        this.generateTimeSlots();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  generateTimeSlots(): void {
    this.timeSlots = [];
    for (let hour = 0; hour < 24; hour++) {
      const displayTime = this.formatHour(hour);
      
      this.timeSlots.push({
        hour,
        displayTime,
        tasks: [] // We'll position tasks absolutely, not in slots
      });
    }
    
    console.log(`Generated ${this.timeSlots.length} time slots (0-23 hours)`);
    console.log('Each hour slot is 100px tall');
    console.log('Total timeline height: 2400px');
  }

  // Get tasks with their visual positioning for timeline
  getTimelineTasksWithPosition(): TimelineTaskLayout[] {
    const scheduledTasks = this.tasks.filter(task => task.due_time);

    const tasksWithPosition: TimelineTaskLayout[] = scheduledTasks.map(task => {
      const [startHour, startMinute] = task.due_time!.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;

      let durationMinutes = 60;
      const endTime = (task as any).end_time;
      if (endTime) {
        const [endHour, endMinute] = endTime.split(':').map(Number);
        const endMinutes = endHour * 60 + endMinute;
        durationMinutes = endMinutes - startMinutes;

        if (durationMinutes <= 0) {
          durationMinutes = 60;
        }
      }

      // Keep visual height aligned with overlap math so short tasks do not collide.
      const height = Math.max(durationMinutes * this.PIXELS_PER_MINUTE, this.MIN_TASK_HEIGHT);
      const visualDurationMinutes = height / this.PIXELS_PER_MINUTE;
      const topPosition = startMinutes * this.PIXELS_PER_MINUTE;

      return {
        ...task,
        topPosition,
        height,
        startTime: task.due_time,
        endTime: endTime || this.calculateEndTime(task.due_time!, durationMinutes / 60),
        startMinutes,
        durationMinutes: visualDurationMinutes,
        visualEndMinutes: startMinutes + visualDurationMinutes,
        column: 0,
        totalColumns: 1,
        columnSpan: 1
      };
    });

    return this.assignColumnsToTasks(tasksWithPosition);
  }

  assignColumnsToTasks(tasks: TimelineTaskLayout[]): TimelineTaskLayout[] {
    const sorted = [...tasks].sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }

      return b.visualEndMinutes - a.visualEndMinutes;
    });

    const groups: Array<{ tasks: TimelineTaskLayout[]; columns: TimelineTaskLayout[][]; maxEnd: number }> = [];
    let currentGroup: { tasks: TimelineTaskLayout[]; columns: TimelineTaskLayout[][]; maxEnd: number } | null = null;

    sorted.forEach(task => {
      if (!currentGroup || task.startMinutes >= currentGroup.maxEnd) {
        currentGroup = {
          tasks: [],
          columns: [],
          maxEnd: task.visualEndMinutes
        };
        groups.push(currentGroup);
      }

      let columnIndex = 0;
      while (!this.canPlaceInColumn(task, currentGroup.columns[columnIndex])) {
        columnIndex++;
      }

      if (!currentGroup.columns[columnIndex]) {
        currentGroup.columns[columnIndex] = [];
      }

      task.column = columnIndex;
      currentGroup.columns[columnIndex].push(task);
      currentGroup.tasks.push(task);
      currentGroup.maxEnd = Math.max(currentGroup.maxEnd, task.visualEndMinutes);
    });

    groups.forEach(group => {
      const totalColumns = group.columns.length;

      group.tasks.forEach(task => {
        task.totalColumns = totalColumns;
        task.columnSpan = this.calculateColumnSpan(task, group.columns);
      });
    });

    return sorted;
  }

  private canPlaceInColumn(task: TimelineTaskLayout, columnTasks?: TimelineTaskLayout[]): boolean {
    if (!columnTasks) {
      return true;
    }

    return !columnTasks.some(existingTask => this.tasksOverlap(task, existingTask));
  }

  private calculateColumnSpan(task: TimelineTaskLayout, columns: TimelineTaskLayout[][]): number {
    let span = 1;

    for (let columnIndex = task.column + 1; columnIndex < columns.length; columnIndex++) {
      const hasOverlap = columns[columnIndex].some(existingTask => this.tasksOverlap(task, existingTask));

      if (hasOverlap) {
        break;
      }

      span++;
    }

    return span;
  }

  private tasksOverlap(firstTask: TimelineTaskLayout, secondTask: TimelineTaskLayout): boolean {
    return !(
      firstTask.visualEndMinutes <= secondTask.startMinutes ||
      firstTask.startMinutes >= secondTask.visualEndMinutes
    );
  }

  calculateEndTime(startTime: string, durationHours: number): string {
    const [hour, minute] = startTime.split(':').map(Number);
    const totalMinutes = hour * 60 + minute + (durationHours * 60);
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  }

  formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  isCurrentHour(hour: number): boolean {
    const today = new Date().toISOString().split('T')[0];
    if (this.selectedDate !== today) return false;
    return this.currentTime.getHours() === hour;
  }

  getCurrentTimePosition(): number {
    const minutes = this.currentTime.getMinutes();
    return (minutes / 60) * 100;
  }

  calculateCompletion(): void {
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

  getPriorityClass(priority: string): string {
    const classes: { [key: string]: string } = {
      'low': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-orange-100 text-orange-800',
      'critical': 'bg-red-100 text-red-800'
    };
    return classes[priority] || 'bg-gray-100 text-gray-800';
  }

  getPriorityBorderClass(priority: string): string {
    const classes: { [key: string]: string } = {
      'low': 'border-l-4 border-green-500',
      'medium': 'border-l-4 border-yellow-500',
      'high': 'border-l-4 border-orange-500',
      'critical': 'border-l-4 border-red-500'
    };
    return classes[priority] || 'border-l-4 border-gray-500';
  }

  drop(event: CdkDragDrop<Task[]>): void {
    moveItemInArray(this.tasks, event.previousIndex, event.currentIndex);
    const taskIds = this.tasks.map(t => t.id);
    this.taskService.reorderTasks(taskIds).subscribe();
  }

  onCompleteClick(event: Event, task: Task): void {
    event.stopPropagation();
    event.preventDefault();
    console.log('Complete button clicked for task:', task.title, 'is_completed:', task.is_completed);
    this.toggleComplete(task);
  }

  toggleComplete(task: Task): void {
    console.log('toggleComplete called for task:', task.id, 'current status:', task.is_completed);
    
    if (this.completingTaskId === task.id) {
      console.log('Already processing this task');
      return;
    }
    
    this.completingTaskId = task.id;
    
    // Toggle between complete and incomplete
    const apiCall = task.is_completed 
      ? this.taskService.markIncomplete(task.id)
      : this.taskService.markComplete(task.id);
    
    const message = task.is_completed 
      ? 'Task marked as incomplete'
      : 'Task completed! 🎉';
    
    console.log('Calling API:', task.is_completed ? 'markIncomplete' : 'markComplete');
    
    apiCall.subscribe({
      next: (response) => {
        console.log('API response:', response);
        this.snackBar.open(message, 'Close', { duration: 2000 });
        this.completingTaskId = null;
        this.loadTasks();
      },
      error: (error) => {
        console.error('Error toggling task completion:', error);
        console.error('Error details:', error.error);
        this.snackBar.open('Failed to update task: ' + (error.error?.message || error.message), 'Close', { duration: 3000 });
        this.completingTaskId = null;
      }
    });
  }

  openTaskDialog(task?: Task): void {
    const dialogRef = this.dialog.open(TaskFormComponent, {
      width: '600px',
      data: { task }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTasks();
      }
    });
  }

  deleteTask(task: Task, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      this.taskService.deleteTask(task.id).subscribe(() => {
        this.snackBar.open('Task deleted', 'Close', { duration: 2000 });
        this.loadTasks();
      });
    }
  }

  onDateChange(): void {
    this.loadTasks();
  }

  setViewMode(mode: string): void {
    console.log('setViewMode called with:', mode);
    this.viewMode = mode;
    console.log('viewMode set to:', this.viewMode);
    this.cdr.detectChanges();
    console.log('Change detection triggered');
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'timeline' ? 'list' : 'timeline';
    console.log('View mode toggled to:', this.viewMode);
    this.cdr.detectChanges(); // Force change detection
    console.log('After change detection, viewMode:', this.viewMode);
  }

  getUnscheduledTasks(): Task[] {
    return this.tasks.filter(task => !task.due_time);
  }

  isListView(): boolean {
    return this.viewMode === 'list';
  }

  isTimelineView(): boolean {
    return this.viewMode === 'timeline';
  }

  openDuplicateDialog(): void {
    console.log('openDuplicateDialog called');
    // Set source date to currently selected date
    this.duplicateSourceDate = this.selectedDate;
    // Set target date to tomorrow by default
    const tomorrow = new Date(this.selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.duplicateTargetDate = tomorrow.toISOString().split('T')[0];
    this.showDuplicateDialog = true;
    
    console.log('Opened duplicate dialog:');
    console.log('  showDuplicateDialog:', this.showDuplicateDialog);
    console.log('  Source date:', this.duplicateSourceDate);
    console.log('  Target date:', this.duplicateTargetDate);
  }

  closeDuplicateDialog(): void {
    this.showDuplicateDialog = false;
    this.duplicateSourceDate = '';
    this.duplicateTargetDate = '';
  }

  duplicateSchedule(): void {
    console.log('duplicateSchedule called');
    console.log('  duplicateSourceDate:', this.duplicateSourceDate, 'type:', typeof this.duplicateSourceDate);
    console.log('  duplicateTargetDate:', this.duplicateTargetDate, 'type:', typeof this.duplicateTargetDate);
    
    if (!this.duplicateSourceDate || !this.duplicateTargetDate) {
      this.snackBar.open('Please select both source and target dates', 'Close', { duration: 3000 });
      return;
    }

    if (this.duplicateSourceDate === this.duplicateTargetDate) {
      this.snackBar.open('Source and target dates must be different', 'Close', { duration: 3000 });
      return;
    }

    console.log('Duplicating schedule:');
    console.log('  Source date:', this.duplicateSourceDate);
    console.log('  Target date:', this.duplicateTargetDate);

    this.duplicating = true;
    this.taskService.duplicateDaySchedule(this.duplicateSourceDate, this.duplicateTargetDate).subscribe({
      next: (response) => {
        console.log('Duplicate response:', response);
        const message = response.data.count > 0 
          ? `Successfully duplicated ${response.data.count} tasks!`
          : 'No tasks found on the source date to duplicate.';
        this.snackBar.open(message, 'Close', { duration: 3000 });
        this.closeDuplicateDialog();
        this.duplicating = false;
        
        // If target date is the currently selected date, reload tasks
        if (this.duplicateTargetDate === this.selectedDate) {
          this.loadTasks();
        }
      },
      error: (error) => {
        console.error('Error duplicating schedule:', error);
        console.error('Error details:', error.error);
        this.snackBar.open('Failed to duplicate schedule: ' + (error.error?.error?.message || error.message), 'Close', { duration: 5000 });
        this.duplicating = false;
      }
    });
  }
}
