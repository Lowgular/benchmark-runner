import { Injectable } from '../testing-decorators';
import { AuditLog } from './audit-log';

@Injectable()
export class AuditLogService {
  list(): AuditLog[] {
    return [];
  }
}
