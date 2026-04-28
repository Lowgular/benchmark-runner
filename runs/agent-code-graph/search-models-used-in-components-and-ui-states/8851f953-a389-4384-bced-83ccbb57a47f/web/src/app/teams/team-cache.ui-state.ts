import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Team } from './team';

@Injectable({ providedIn: 'root' })
export class TeamCacheUiState {
  private readonly http: HttpClient = inject(HttpClient);

  private readonly cachedTeam: WritableSignal<Team | null> =
    signal<Team | null>(null);

  getCachedTeam(): Team | null {
    return this.cachedTeam();
  }

  setCachedTeam(team: Team | null): void {
    this.cachedTeam.set(team);
  }

  refreshTeam(id: number): void {
    this.http.get<Team>(`/api/teams/${id}`).subscribe((team) => {
      this.cachedTeam.set(team);
    });
  }
}
