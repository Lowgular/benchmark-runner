import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginRequest, LoginResponse } from './login.model';

@Injectable({ providedIn: 'root' })
export class LoginService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'https://us-central1-lowgular-platform-c0e93.cloudfunctions.net/api/mock/login';

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.apiUrl, request);
  }
}
