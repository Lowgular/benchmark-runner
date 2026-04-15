import { inject, Injectable } from '@angular/core';
import { AnalyticsService } from './analytics.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsState {
  private readonly analyticsService = inject(AnalyticsService);
  trackUrl(url: string) {
    this.analyticsService.track({ id: 'url', value: url });
  }
}
