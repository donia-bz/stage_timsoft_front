import { Component } from '@angular/core';

interface Claim {
  bordereau: string;
  probleme: string;
  statut: string;
  date: string;
  observations: string;
  traiteLe?: string;
}

@Component({
  selector: 'app-reclamations',
  templateUrl: './reclamations.component.html',
  styleUrls: ['./reclamations.component.scss']
})
export class ReclamationsComponent {
  objetOptions = ['Bordereaux', 'Problème', 'Livraison', 'Retard', 'Dommages'];
  selectedObjet = '';
  barcode = '';
  description = '';
  formError = '';

  claims: Claim[] = [];

  addClaim() {
    this.formError = '';
    if (!this.selectedObjet || !this.barcode || !this.description) {
      this.formError = 'Veuillez renseigner tous les champs.';
      return;
    }

    this.claims.push({
      bordereau: this.selectedObjet,
      probleme: this.description,
      statut: 'En attente',
      date: new Date().toLocaleDateString('fr-FR'),
      observations: this.barcode,
      traiteLe: ''
    });

    this.selectedObjet = '';
    this.barcode = '';
    this.description = '';
  }
}
