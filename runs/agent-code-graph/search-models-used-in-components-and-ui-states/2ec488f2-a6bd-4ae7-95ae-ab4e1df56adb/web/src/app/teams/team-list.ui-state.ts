import { signal, WritableSignal } from '@angular/core';
import { TeamActionModel } from './team-action.model';
import { TeamFilterModel } from './team-filter.model';
import { Team } from './team';

export class TeamListUiState {
  private readonly selectedTeam: WritableSignal<Team | null> =
    signal<Team | null>(null);
  private readonly filter: WritableSignal<TeamFilterModel> = signal({
    searchTerm: '',
    city: null,
  });
  private readonly pendingAction: WritableSignal<TeamActionModel | null> =
    signal<TeamActionModel | null>(null);

  getSelectedTeam(): Team | null {
    return this.selectedTeam();
  }

  setSelectedTeam(team: Team | null): void {
    this.selectedTeam.set(team);
  }

  getFilter(): TeamFilterModel {
    return this.filter();
  }

  setFilter(filter: TeamFilterModel): void {
    this.filter.set(filter);
  }

  getPendingAction(): TeamActionModel | null {
    return this.pendingAction();
  }

  setPendingAction(action: TeamActionModel | null): void {
    this.pendingAction.set(action);
  }
}
