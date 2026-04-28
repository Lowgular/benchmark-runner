import { Team } from './team';

export interface TeamActionModel {
  readonly team: Team;
  setTeam(team: Team): void;
}
