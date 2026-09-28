import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GRADES, Grade } from '../../core/models';
import { BackupBundle, BackupService, backupFilename, readBackup } from '../../core/progress/backup';
import { MAX_NAME_LENGTH, Profile, PROFILE_COLORS, PROFILE_ICONS, ProfileColor, ProfileStore } from '../../core/progress/profile-store';
import { ProgressStore } from '../../core/progress/progress-store';
import { STATE_OPTIONS } from '../../core/curriculum/states';

@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  protected readonly store = inject(ProfileStore);
  private readonly progress = inject(ProgressStore);
  private readonly backup = inject(BackupService);
  private readonly router = inject(Router);

  protected readonly icons = PROFILE_ICONS;
  protected readonly colors = PROFILE_COLORS;
  protected readonly colorNames: Record<ProfileColor, string> = { primary: 'Lila', sun: 'Gelb', mint: 'Türkis', sky: 'Blau', coral: 'Rot' };
  protected readonly grades = GRADES;
  protected readonly states = STATE_OPTIONS;
  protected readonly maxName = MAX_NAME_LENGTH;

  /** `null` = Liste, `'new'` = neues Profil, sonst ID des bearbeiteten Profils */
  protected readonly editing = signal<string | null>(this.store.profiles().length ? null : 'new');
  protected readonly name = signal('');
  protected readonly icon = signal<string>(PROFILE_ICONS[0]);
  protected readonly color = signal<ProfileColor>('primary');
  protected readonly grade = signal<Grade | null>(null);
  protected readonly state = signal('de');

  protected readonly cards = computed(() => this.store.profiles().map((p) => ({ ...p, stars: this.progress.starsOf(p.id) })));
  protected readonly canSave = computed(() => this.name().trim().length > 0);

  /** Aus einer gewählten Datei gelesene, aber noch nicht bestätigte Sicherung. */
  protected readonly importPreview = signal<BackupBundle | null>(null);
  protected readonly importError = signal<string | null>(null);

  protected choose(profile: Profile): void {
    this.store.select(profile.id);
    void this.router.navigate(['/']);
  }

  protected startNew(): void {
    this.fill({ name: '', icon: PROFILE_ICONS[this.store.profiles().length % PROFILE_ICONS.length], color: 'primary', grade: null, state: 'de' });
    this.editing.set('new');
  }

  protected edit(profile: Profile, event: Event): void {
    event.stopPropagation();
    this.fill(profile);
    this.editing.set(profile.id);
  }

  protected save(): void {
    if (!this.canSave()) return;
    const draft = { name: this.name(), icon: this.icon(), color: this.color(), grade: this.grade(), state: this.state() };
    const id = this.editing();
    if (id === 'new') {
      this.store.create(draft);
      void this.router.navigate(['/']);
    } else if (id) {
      this.store.update(id, draft);
    }
    this.editing.set(null);
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected remove(): void {
    const id = this.editing();
    const profile = this.store.profiles().find((p) => p.id === id);
    if (profile && confirm(`Profil „${profile.name}“ mit allen Sternen und Abzeichen löschen?`)) {
      this.store.remove(profile.id);
      this.editing.set(this.store.profiles().length ? null : 'new');
    }
  }

  protected setGrade(value: string): void {
    const n = Number(value);
    this.grade.set(GRADES.includes(n as Grade) ? (n as Grade) : null);
  }

  /** Lädt alle Profile + Fortschritt dieses Geräts als Datei herunter (zum Übertragen auf ein anderes Gerät). */
  protected downloadBackup(): void {
    const bundle = this.backup.export();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Liest die gewählte Datei; zeigt bei Erfolg die Bestätigung, sonst eine Fehlermeldung. */
  protected onFileSelected(event: Event, input: HTMLInputElement): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    input.value = ''; // dieselbe Datei später erneut wählbar machen
    if (!file) return;
    this.importError.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      const bundle = readBackup(String(reader.result));
      if (bundle) this.importPreview.set(bundle);
      else this.importError.set('Diese Datei ist keine gültige Mathe-Rakete-Sicherung.');
    };
    reader.onerror = () => this.importError.set('Die Datei konnte nicht gelesen werden.');
    reader.readAsText(file);
  }

  /** Übernimmt die eingelesene Sicherung – ersetzt alles auf diesem Gerät – und lädt neu. */
  protected confirmImport(): void {
    const bundle = this.importPreview();
    if (!bundle) return;
    this.backup.restore(bundle);
    location.reload(); // alle Speicher (Profile, Fortschritt) frisch von der Platte lesen
  }

  protected cancelImport(): void {
    this.importPreview.set(null);
    this.importError.set(null);
  }

  private fill(p: Omit<Profile, 'id'>): void {
    this.name.set(p.name);
    this.icon.set(p.icon);
    this.color.set(p.color);
    this.grade.set(p.grade);
    this.state.set(p.state);
  }
}
