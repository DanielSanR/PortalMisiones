import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FormGroup, FormsModule } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';
import { FormErrorMessageDirective } from './FormErrorMessage.directive';
import { ICON_CATALOG, IconCategory } from './icon-catalog';

@Component({
  selector: 'app-dynamic-form-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TextFieldModule,
    FormErrorMessageDirective,
  ],
  templateUrl: './dynamic-form-field.component.html',
  styleUrls: ['./dynamic-form-field.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DynamicFormFieldComponent implements OnInit {
  showPassword = false;

  // Icon picker state
  iconSearch = '';
  selectedIconCategory: IconCategory = 'Todos';
  iconCategories: IconCategory[] = ['Todos', 'Gobierno', 'Salud', 'Educación', 'Transporte', 'Documentos', 'Finanzas', 'Trabajo', 'Vivienda', 'Familia', 'General'];
  filteredIcons: string[] = [];

  @Input() field!: FieldConfig;
  @Input() group!: FormGroup;

  ngOnInit() {
    if (!this.field || !this.group) {
      console.error('Campo o grupo no definidos en DynamicFormFieldComponent');
    }
    if (this.field?.type === 'icon-picker') {
      this.filterIcons();
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  preventE(event: KeyboardEvent) {
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
    }
  }

  // --- Icon picker methods ---

  filterIcons(): void {
    const search = this.iconSearch.toLowerCase().trim();
    let icons: string[];

    if (this.selectedIconCategory === 'Todos') {
      icons = Object.values(ICON_CATALOG).flat();
    } else {
      icons = ICON_CATALOG[this.selectedIconCategory] || [];
    }

    if (search) {
      icons = icons.filter(icon => icon.includes(search));
    }

    this.filteredIcons = [...new Set(icons)];
  }

  selectIconCategory(category: IconCategory): void {
    this.selectedIconCategory = category;
    this.filterIcons();
  }

  selectIcon(icon: string): void {
    this.group.get(this.field.name)?.setValue(icon);
    this.group.get(this.field.name)?.markAsTouched();
  }

  clearIcon(): void {
    this.group.get(this.field.name)?.setValue('');
    this.group.get(this.field.name)?.markAsTouched();
  }
}
