import { Component, OnInit, OnDestroy } from '@angular/core';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { UserService, UserPreferences } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AgentSyncService } from '../../core/services/agent-sync.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  currentTheme: Theme = 'light';
  themes: Theme[] = ['light', 'dark', 'custom'];
  preferences: UserPreferences | null = null;
  currentUser: User | null = null;
  profileForm: FormGroup;
  loading = false;
  private authSubscription?: Subscription;
  private syncSubscription?: Subscription;

  notificationTimings = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '60 minutes' },
    { value: 120, label: '2 hours' }
  ];

  constructor(
    private themeService: ThemeService,
    private userService: UserService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private agentSyncService: AgentSyncService
  ) {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.pattern(/^\+?[1-9]\d{1,14}$/)]]
    });
  }

  ngOnInit(): void {
    this.currentTheme = this.themeService.getCurrentTheme();
    this.authSubscription = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
        this.profileForm.patchValue({
          name: user.name,
          phoneNumber: user.phone_number || ''
        });
      }
    });
    this.loadUserData();
    this.loadPreferences();
    this.syncSubscription = this.agentSyncService.effects$.subscribe((effects) => {
      if (effects.refreshProfile) {
        this.loadUserData();
      }

      if (effects.refreshPreferences) {
        this.loadPreferences();
      }

      if (effects.theme) {
        this.currentTheme = effects.theme as Theme;
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.syncSubscription?.unsubscribe();
  }

  loadUserData(): void {
    this.userService.getProfile().subscribe();
  }

  loadPreferences(): void {
    this.userService.getPreferences().subscribe({
      next: (response) => {
        this.preferences = response.data.preferences;
      }
    });
  }

  changeTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
    this.currentTheme = theme;
    this.snackBar.open('Theme updated!', 'Close', { duration: 2000 });
  }

  updateProfile(): void {
    if (this.profileForm.valid) {
      this.loading = true;
      this.userService.updateProfile(this.profileForm.value).subscribe({
        next: () => {
          this.snackBar.open('Profile updated successfully!', 'Close', { duration: 3000 });
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    }
  }

  updateNotificationEnabled(enabled: boolean): void {
    if (this.preferences) {
      this.userService.updatePreferences({ notification_enabled: enabled }).subscribe({
        next: (response) => {
          this.preferences = response.data.preferences;
          this.snackBar.open('Notification settings updated!', 'Close', { duration: 2000 });
        }
      });
    }
  }

  updateNotificationTiming(timing: number): void {
    if (this.preferences) {
      this.userService.updatePreferences({ notification_timing: timing }).subscribe({
        next: (response) => {
          this.preferences = response.data.preferences;
          this.snackBar.open('Notification timing updated!', 'Close', { duration: 2000 });
        }
      });
    }
  }
}
