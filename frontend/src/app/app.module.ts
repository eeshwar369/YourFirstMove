import { ReactiveFormsModule } from '@angular/forms';

import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule } from '@angular/cdk/drag-drop';

// Components
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RoadmapComponent } from './features/roadmap/roadmap.component';
import { MonthlyCalendarComponent } from './features/monthly-calendar/monthly-calendar.component';
import { AnalyticsDashboardComponent } from './features/analytics/analytics-dashboard/analytics-dashboard.component';
import { SettingsComponent } from './features/settings/settings.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { OAuthCallbackComponent } from './features/auth/oauth-callback/oauth-callback.component';
import { TaskFormComponent } from './features/tasks/task-form/task-form.component';
import { TaskItemComponent } from './features/tasks/task-item/task-item.component';
import { TaskListComponent } from './features/tasks/task-list/task-list.component';
import { LoadingSpinnerComponent } from './shared/components/loading-spinner/loading-spinner.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    RoadmapComponent,
    MonthlyCalendarComponent,
    AnalyticsDashboardComponent,
    SettingsComponent,
    LoginComponent,
    RegisterComponent,
    OAuthCallbackComponent,
    TaskFormComponent,
    TaskItemComponent,
    TaskListComponent,
    LoadingSpinnerComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    ReactiveFormsModule,
MatSlideToggleModule,
    RouterModule,
    
    // Angular Material Components & Toolkits
    MatIconModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatCheckboxModule,
    MatTooltipModule,
    DragDropModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }