import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MemberEntity } from './member.entity';

@Entity({ name: 'teams' })
export class TeamEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city?: string | null;

  @ManyToMany(() => MemberEntity, { cascade: false })
  @JoinTable({
    name: 'team_members',
    joinColumn: { name: 'team_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'member_id', referencedColumnName: 'id' },
  })
  members!: MemberEntity[];
}
