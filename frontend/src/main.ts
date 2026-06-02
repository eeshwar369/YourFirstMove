import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'; // 👈 Added '@angular/'
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch((err: any) => console.error(err));