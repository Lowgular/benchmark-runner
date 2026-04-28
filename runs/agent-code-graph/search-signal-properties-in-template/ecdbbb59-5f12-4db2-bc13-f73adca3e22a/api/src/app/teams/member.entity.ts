import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'members' })
export class MemberEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  name!: string;
}
