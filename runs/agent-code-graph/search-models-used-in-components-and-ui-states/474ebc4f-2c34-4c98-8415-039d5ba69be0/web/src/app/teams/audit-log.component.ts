import { Component } from '../testing-decorators';
import { AuditLog } from './audit-log';

@Component({
  standalone: true,
  selector: 'app-audit-log',
})
export class AuditLogComponent {
  selected: AuditLog | null = null;

  render(record: AuditLog): string {
    return record.action;
  }
}
