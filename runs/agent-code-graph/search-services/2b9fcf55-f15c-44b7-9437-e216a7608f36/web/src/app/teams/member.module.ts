import { NgModule } from '@angular/core';
import { AlertDirective } from '../shared/disabled';
import { ButtonComponent } from '../shared/button';
import { MemberComponent } from './member.component';

@NgModule({
  imports: [ButtonComponent, AlertDirective],
  declarations: [MemberComponent],
  exports: [MemberComponent],
})
export class MemberModule {}
