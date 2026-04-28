import { BehaviorSubject } from 'rxjs';
import { Team } from './team';

export class TeamSubjectUiState {
  private readonly selectedTeam = new BehaviorSubject<Team | null>(null);

  getSelectedTeam(): Team | null {
    return this.selectedTeam.value;
  }

  setSelectedTeam(team: Team | null): void {
    this.selectedTeam.next(team);
  }
}
