import { Pipe, PipeTransform } from '@angular/core';
import { ROLE_TO_SPANISH, UserRole } from '../../core/enums/user-role.enum';

@Pipe({ name: 'rolLabel', standalone: true, pure: true })
export class RolLabelPipe implements PipeTransform {
  transform(rol: UserRole): string {
    return ROLE_TO_SPANISH[rol] || rol;
  }
}
