import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Task, CreateTaskDTO, UpdateTaskDTO } from '../models/task.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly API_URL = `${environment.apiUrl}/tasks`;
  
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  public tasks$ = this.tasksSubject.asObservable();

  constructor(private http: HttpClient) {}

  getTasks(filters?: any): Observable<{ success: boolean; data: { tasks: Task[]; total: number } }> {
    let params = new HttpParams();
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params = params.set(key, filters[key]);
        }
      });
    }

    return this.http.get<{ success: boolean; data: { tasks: Task[]; total: number } }>(
      this.API_URL,
      { params }
    ).pipe(
      tap(response => {
        if (response.success) {
          this.tasksSubject.next(response.data.tasks);
        }
      })
    );
  }

  getTask(id: number): Observable<{ success: boolean; data: { task: Task } }> {
    return this.http.get<{ success: boolean; data: { task: Task } }>(`${this.API_URL}/${id}`);
  }

  createTask(task: CreateTaskDTO): Observable<{ success: boolean; data: { task: Task } }> {
    return this.http.post<{ success: boolean; data: { task: Task } }>(this.API_URL, task)
      .pipe(
        tap(() => this.refreshTasks())
      );
  }

  updateTask(id: number, updates: UpdateTaskDTO): Observable<{ success: boolean; data: { task: Task } }> {
    return this.http.put<{ success: boolean; data: { task: Task } }>(`${this.API_URL}/${id}`, updates)
      .pipe(
        tap(() => this.refreshTasks())
      );
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`)
      .pipe(
        tap(() => this.refreshTasks())
      );
  }

  markComplete(id: number): Observable<{ success: boolean; data: { task: Task } }> {
    return this.http.patch<{ success: boolean; data: { task: Task } }>(`${this.API_URL}/${id}/complete`, {})
      .pipe(
        tap(() => this.refreshTasks())
      );
  }

  markIncomplete(id: number): Observable<{ success: boolean; data: { task: Task } }> {
    return this.http.patch<{ success: boolean; data: { task: Task } }>(`${this.API_URL}/${id}/uncomplete`, {})
      .pipe(
        tap(() => this.refreshTasks())
      );
  }

  reorderTasks(taskIds: number[]): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${this.API_URL}/reorder`, { taskIds });
  }

  getTasksByDate(date: string): Observable<{ success: boolean; data: { tasks: Task[] } }> {
    return this.http.get<{ success: boolean; data: { tasks: Task[] } }>(`${this.API_URL}/daily/${date}`);
  }

  getTasksByMonth(month: string): Observable<{ success: boolean; data: { tasks: Task[] } }> {
    return this.http.get<{ success: boolean; data: { tasks: Task[] } }>(`${this.API_URL}/monthly/${month}`);
  }

  duplicateDaySchedule(sourceDate: string, targetDate: string): Observable<{ success: boolean; data: { tasks: Task[]; count: number }; message: string }> {
    return this.http.post<{ success: boolean; data: { tasks: Task[]; count: number }; message: string }>(
      `${this.API_URL}/duplicate-day`,
      { sourceDate, targetDate }
    ).pipe(
      tap(() => this.refreshTasks())
    );
  }

  private refreshTasks(): void {
    this.getTasks().subscribe();
  }
  /**
 * Fetches the computed dead-air gaps and micro-task coaching suggestions
 * for a specific calendar date from the backend analytics engine.
 */
getScheduleGaps(date: string): Observable<any> {
  return this.http.get<any>(`${this.API_URL}/tasks/analytics/gaps/${date}`);
}
}
