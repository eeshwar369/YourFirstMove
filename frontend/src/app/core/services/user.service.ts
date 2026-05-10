import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface UserPreferences {
  id: number;
  user_id: number;
  theme: string;
  notification_enabled: boolean;
  notification_timing: number;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly API_URL = `${environment.apiUrl}/users`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getProfile(): Observable<{ success: boolean; data: { user: User } }> {
    return this.http.get<{ success: boolean; data: { user: User } }>(`${this.API_URL}/profile`)
      .pipe(
        tap((response) => {
          if (response.success) {
            this.authService.updateCurrentUser(response.data.user);
          }
        })
      );
  }

  updateProfile(data: { name?: string; phoneNumber?: string }): Observable<{ success: boolean; data: { user: User } }> {
    return this.http.put<{ success: boolean; data: { user: User } }>(`${this.API_URL}/profile`, data)
      .pipe(
        tap((response) => {
          if (response.success) {
            this.authService.updateCurrentUser(response.data.user);
          }
        })
      );
  }

  getPreferences(): Observable<{ success: boolean; data: { preferences: UserPreferences } }> {
    return this.http.get<{ success: boolean; data: { preferences: UserPreferences } }>(`${this.API_URL}/preferences`);
  }

  updatePreferences(preferences: Partial<UserPreferences>): Observable<{ success: boolean; data: { preferences: UserPreferences } }> {
    return this.http.put<{ success: boolean; data: { preferences: UserPreferences } }>(`${this.API_URL}/preferences`, preferences);
  }
}
