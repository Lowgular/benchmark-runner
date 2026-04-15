import { IsString, MaxLength, MinLength } from 'class-validator';

/** Payload shape for team members; persisted via MemberEntity inside TeamsService only. */
export class MemberInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
