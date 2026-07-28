import { Component } from '@angular/core';

@Component({
  selector: 'app-paiements',
  templateUrl: './paiements.component.html',
  styleUrls: ['./paiements.component.scss']
})
export class PaiementsComponent {
  month = 'Juillet';
  year = '2026';
  months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  years = ['2024', '2025', '2026', '2027', '2028'];

  validatePayments() {
    alert(`Paiements filtrés pour ${this.month} ${this.year}`);
  }
}
