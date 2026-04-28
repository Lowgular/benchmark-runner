import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Team } from './team';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);

  private readonly apiBaseUrl = 'http://localhost:3000/api/teams';

  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(this.apiBaseUrl);
  }

  getTeam(id: number): Observable<Team> {
    return this.http.get<Team>(`${this.apiBaseUrl}/${id}`);
  }

  createTeam(body: { name: string; city: string | null }) {
    return this.http.post<Team>(this.apiBaseUrl, body);
  }

  updateTeam(
    id: number,
    body: { name: string; city: string | null }
  ): Observable<Team> {
    return this.http.patch<Team>(`${this.apiBaseUrl}/${id}`, body);
  }

  deleteTeam(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiBaseUrl}/${id}`);
  }
}
