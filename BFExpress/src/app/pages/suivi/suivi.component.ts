import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Commande } from '../../services/api.service';

@Component({
  selector: 'app-suivi',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './suivi.component.html',
  styleUrls: ['./suivi.component.scss']
})
export class SuiviComponent implements OnInit {
  searchTerm = '';
  searchResult: Commande | null = null;
  loading = false;
  errorMessage = '';

  detailedStatuses = [
    { key: 'EN_ATTENTE', label: 'En attente' },
    { key: 'MANIFESTE', label: 'Manifesté' },
    { key: 'A_ENLEVER', label: 'À enlever' },
    { key: 'ENLEVE', label: 'Enlevé' },
    { key: 'AU_DEPOT', label: 'Au dépôt' },
    { key: 'EN_LIVRAISON', label: 'En livraison' },
    { key: 'ECHEC_LIVRAISON', label: 'Échec livraison' },
    { key: 'LIVRE', label: 'Livré' },
    { key: 'LIVRE_PAYE', label: 'Livré payé' },
    { key: 'ANNULEE', label: 'Annulée' }
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {}

  onSearch(): void {
    if (!this.searchTerm?.trim()) {
      this.searchResult = null;
      this.errorMessage = '';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.apiService.searchCommandes(this.searchTerm).subscribe({
      next: (results) => {
        console.log('Résultats de recherche:', results);
        this.searchResult = results?.[0] || null;
        this.loading = false;
        if (!this.searchResult) {
          this.errorMessage = 'Aucun résultat trouvé pour : ' + this.searchTerm;
        }
      },
      error: (err) => {
        console.error('Erreur de recherche:', err);
        this.errorMessage =
          'Erreur lors de la recherche : ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.searchResult = null;
        this.loading = false;
      }
    });
  }

  getStatusLabel(statut: string): string {
    const found = this.detailedStatuses.find(s => s.key === statut);
    return found ? found.label : statut;
  }

  getStatusClass(statut: string): string {
    const statusClasses: { [key: string]: string } = {
      'EN_ATTENTE': 'status-pending',
      'A_ENLEVER': 'status-info',
      'ENLEVE': 'status-info',
      'AU_DEPOT': 'status-info',
      'EN_LIVRAISON': 'status-in-progress',
      'ECHEC_LIVRAISON': 'status-danger',
      'LIVRE': 'status-success',
      'LIVRE_PAYE': 'status-success',
      'ANNULEE': 'status-muted'
    };
    return statusClasses[statut] || 'status-default';
  }

  isStatusReached(targetStatus: string, currentStatus: string): boolean {
    const statusOrder = [
      'EN_ATTENTE',
      'MANIFESTE',
      'A_ENLEVER',
      'ENLEVE',
      'AU_DEPOT',
      'EN_LIVRAISON',
      'ECHEC_LIVRAISON',
      'LIVRE',
      'LIVRE_PAYE',
      'ANNULEE'
    ];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const targetIndex = statusOrder.indexOf(targetStatus);
    return currentIndex >= targetIndex;
  }
}
