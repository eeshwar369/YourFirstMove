import { Component, OnInit, OnDestroy } from '@angular/core';
import { TaskService } from '../../core/services/task.service';
import { Task } from '../../core/models/task.model';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AgentSyncService } from '../../core/services/agent-sync.service';

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
}

@Component({
  selector: 'app-monthly-calendar',
  templateUrl: './monthly-calendar.component.html',
  styleUrls: ['./monthly-calendar.component.scss']
})
export class MonthlyCalendarComponent implements OnInit, OnDestroy {
  currentDate = new Date();
  calendarDays: CalendarDay[] = [];
  loading = false;
  monthName = '';
  year = 0;
  private syncSubscription?: Subscription;

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(
    private taskService: TaskService,
    private router: Router,
    private agentSyncService: AgentSyncService
  ) {}

  ngOnInit(): void {
    this.loadCalendar();
    this.syncSubscription = this.agentSyncService.effects$.subscribe((effects) => {
      if (!effects.refreshTasks) {
        return;
      }

      if (!effects.affectedDates || effects.affectedDates.some((date) => this.matchesCurrentMonth(date))) {
        this.loadCalendar();
      }
    });
  }

  ngOnDestroy(): void {
    this.syncSubscription?.unsubscribe();
  }

  loadCalendar(): void {
    this.loading = true;
    this.monthName = this.currentDate.toLocaleString('default', { month: 'long' });
    this.year = this.currentDate.getFullYear();

    const month = this.currentDate.getMonth();
    const year = this.currentDate.getFullYear();
    const monthString = `${year}-${String(month + 1).padStart(2, '0')}`;

    console.log('Loading calendar for month:', monthString);

    this.taskService.getTasksByMonth(monthString).subscribe({
      next: (response) => {
        const tasks = response.data.tasks;
        console.log('Received tasks:', tasks.length);
        
        // Log ALL task dates to see what we have
        const tasksByDate = tasks.reduce((acc: any, task) => {
          const date = task.due_date.split('T')[0];
          if (!acc[date]) acc[date] = [];
          acc[date].push(task.title);
          return acc;
        }, {});
        console.log('All tasks by date:', tasksByDate);
        
        this.generateCalendarDays(year, month, tasks);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  generateCalendarDays(year: number, month: number, tasks: Task[]): void {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    console.log('Generating calendar for:', { year, month: month + 1, daysInMonth });

    this.calendarDays = [];

    // Add previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      this.calendarDays.push(this.createCalendarDay(date, false, tasks));
    }

    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      this.calendarDays.push(this.createCalendarDay(date, true, tasks));
    }

    // Add next month days to complete the grid
    const remainingDays = 42 - this.calendarDays.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      this.calendarDays.push(this.createCalendarDay(date, false, tasks));
    }

    // Log summary
    const daysWithTasks = this.calendarDays.filter(d => d.totalCount > 0);
    console.log('Calendar generated:', {
      totalDays: this.calendarDays.length,
      daysWithTasks: daysWithTasks.length,
      taskDistribution: daysWithTasks.map(d => ({ date: d.dateString, tasks: d.totalCount }))
    });
  }

  createCalendarDay(date: Date, isCurrentMonth: boolean, allTasks: Task[]): CalendarDay {
    // Create date string in local timezone (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Get today's date in same format
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Filter tasks for this date - compare date strings
    const dayTasks = allTasks.filter(t => {
      // Ensure we're comparing just the date part (YYYY-MM-DD)
      let taskDate = t.due_date;
      
      // If the date includes time or timezone info, extract just the date part
      if (taskDate.includes('T')) {
        taskDate = taskDate.split('T')[0];
      } else if (taskDate.includes(' ')) {
        taskDate = taskDate.split(' ')[0];
      }
      
      const matches = taskDate === dateString;
      
      return matches;
    });
    
    // Log if this day has tasks
    if (dayTasks.length > 0) {
      console.log(`Date ${dateString} has ${dayTasks.length} tasks:`, dayTasks.map(t => t.title));
    }
    
    const completedCount = dayTasks.filter(t => t.is_completed).length;
    const totalCount = dayTasks.length;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      date,
      dateString,
      isCurrentMonth,
      isToday: dateString === todayString,
      tasks: dayTasks,
      completedCount,
      totalCount,
      completionPercentage
    };
  }

  previousMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.loadCalendar();
  }

  nextMonth(): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.loadCalendar();
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.loadCalendar();
  }

  onDayClick(day: CalendarDay): void {
    if (day.isCurrentMonth) {
      this.router.navigate(['/dashboard/roadmap'], {
        queryParams: { date: day.dateString }
      });
    }
  }

  getDayClasses(day: CalendarDay): string {
    const classes = ['calendar-day'];
    if (!day.isCurrentMonth) classes.push('other-month');
    if (day.isToday) classes.push('today');
    if (day.totalCount > 0) classes.push('has-tasks');
    return classes.join(' ');
  }

  getCompletionBadgeClass(percentage: number): string {
    if (percentage === 100) return 'bg-green-500';
    if (percentage > 0) return 'bg-yellow-500';
    return 'bg-gray-400';
  }

  getTaskDotClass(priority: string, isCompleted: boolean): string {
    const baseClasses: { [key: string]: string } = {
      'low': 'bg-green-500',
      'medium': 'bg-yellow-500',
      'high': 'bg-orange-500',
      'critical': 'bg-red-500'
    };
    const colorClass = baseClasses[priority] || 'bg-gray-500';
    return isCompleted ? `${colorClass} opacity-50` : colorClass;
  }

  private matchesCurrentMonth(date: string): boolean {
    const currentMonth = `${this.currentDate.getFullYear()}-${String(this.currentDate.getMonth() + 1).padStart(2, '0')}`;
    return date.startsWith(currentMonth);
  }
}
