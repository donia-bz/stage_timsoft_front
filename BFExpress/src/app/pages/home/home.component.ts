import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  selectedMode: 'client' | 'livreur' = 'client';

  get activeImage(): string {
    return this.selectedMode === 'client'
      ? 'assets/client-illustration.svg'
      : 'assets/livreur-illustration.svg';
  }

  setMode(mode: 'client' | 'livreur'): void {
    this.selectedMode = mode;
  }
}
