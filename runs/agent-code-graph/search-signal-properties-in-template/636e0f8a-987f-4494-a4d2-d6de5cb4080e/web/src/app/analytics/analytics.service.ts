import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ConfigService } from '../config.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly config = inject(ConfigService);
  private readonly apiBaseUrl = `${
    this.config.getConfig().apiBaseUrl
  }/analytics`;

  constructor(private readonly http: HttpClient) {}

  track(obj: { id: string; value: string }) {
    return this.http.post<void>(`${this.apiBaseUrl}/track`, obj);
  }

  getApiBaseUrl() {
    return inject(ConfigService);
  }
}
