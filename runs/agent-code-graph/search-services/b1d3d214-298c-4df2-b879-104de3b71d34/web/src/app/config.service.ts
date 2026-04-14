import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  constructor(private readonly configDefault: ConfigDefault) {}
  getConfig() {
    return {
      apiBaseUrl: this.configDefault.getUrl(),
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ConfigDefault {
  getUrl() {
    return 'http://localhost:3000/api';
  }
}
