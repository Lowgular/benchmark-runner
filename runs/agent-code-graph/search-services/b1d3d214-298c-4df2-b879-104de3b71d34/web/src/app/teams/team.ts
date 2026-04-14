import { Member } from './member';

export type Team = {
  id: number;
  name: string;
  city: string | null;
  members: Member[];
};
