import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTeamDto } from './dto/create-team.dto';
import { MemberInputDto } from './dto/member-input.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { MemberEntity } from './member.entity';
import { TeamEntity } from './team.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamsRepository: Repository<TeamEntity>,
    @InjectRepository(MemberEntity)
    private readonly membersRepository: Repository<MemberEntity>
  ) {}

  findAll(): Promise<TeamEntity[]> {
    return this.teamsRepository.find({
      order: { id: 'ASC' },
      relations: { members: true },
    });
  }

  async findOne(id: number): Promise<TeamEntity> {
    const team = await this.teamsRepository.findOne({
      where: { id },
      relations: { members: true },
    });
    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return team;
  }

  async create(dto: CreateTeamDto): Promise<TeamEntity> {
    const { members: memberInputs, ...fields } = dto;
    const team = this.teamsRepository.create({
      ...fields,
      name: dto.name,
      city: dto.city ?? null,
    });
    if (memberInputs?.length) {
      team.members = await this.resolveMembers(memberInputs);
    }
    const saved = await this.teamsRepository.save(team);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateTeamDto): Promise<TeamEntity> {
    const { members: memberInputs, ...rest } = dto;
    const team = await this.findOne(id);
    const updatedTeam = this.teamsRepository.merge(team, {
      ...rest,
      city: dto.city === undefined ? team.city : dto.city,
    });
    if (memberInputs !== undefined) {
      updatedTeam.members = memberInputs.length
        ? await this.resolveMembers(memberInputs)
        : [];
    }
    await this.teamsRepository.save(updatedTeam);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.teamsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Team ${id} not found`);
    }
  }

  /** Links existing rows by name or creates new MemberEntity rows — internal persistence only. */
  private async resolveMembers(
    inputs: MemberInputDto[]
  ): Promise<MemberEntity[]> {
    const resolved: MemberEntity[] = [];
    for (const { name } of inputs) {
      const trimmed = name.trim();
      let member = await this.membersRepository.findOne({
        where: { name: trimmed },
      });
      if (!member) {
        member = this.membersRepository.create({ name: trimmed });
        member = await this.membersRepository.save(member);
      }
      resolved.push(member);
    }
    return resolved;
  }
}
