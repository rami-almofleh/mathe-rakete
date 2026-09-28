import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GRADE_INFO } from '../../core/curriculum/curriculum';
import { STAGES } from '../../core/models';
import { ProfileStore } from '../../core/progress/profile-store';
import { ProgressStore } from '../../core/progress/progress-store';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly stages = STAGES;
  protected readonly gradeInfo = GRADE_INFO;
  protected readonly mistakes = inject(ProgressStore).mistakes;
  protected readonly profile = inject(ProfileStore).active;
}
