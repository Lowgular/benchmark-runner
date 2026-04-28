import { NgModule } from '@angular/core';
import { ButtonComponent } from '../shared/button';
import { AlertDirective } from '../shared/disabled';
import { MemberComponent } from './member.component';

@NgModule({
  imports: [ButtonComponent, AlertDirective],
  declarations: [MemberComponent],
  exports: [MemberComponent],
})
export class MemberModule {}
