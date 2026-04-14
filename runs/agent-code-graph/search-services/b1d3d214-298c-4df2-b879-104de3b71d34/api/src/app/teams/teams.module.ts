import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberEntity } from './member.entity';
import { TeamEntity } from './team.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeamEntity, MemberEntity])],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
