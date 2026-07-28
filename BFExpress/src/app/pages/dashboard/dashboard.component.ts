import { Component, OnInit } from '@angular/core';
import { ApiService, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  clientName = 'Client';
  clientId = '';
  commandes: Commande[] = [];

  // Stats
  enAttenteCount = 0;
  enCoursCount = 0;
  livreeCount = 0;
  annuleeCount = 0;

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clientName = `${user.prenom} ${user.nom}`;
      this.clientId = user.id;
      this.loadClientCommandes();
    }
  }

  loadClientCommandes(): void {
    if (!this.clientId) return;

    this.apiService.getCommandesByClient(this.clientId).subscribe({
      next: (res) => {
        this.commandes = res;
        this.calculateStats();
      },
      error: (err) => console.error('Error loading client orders:', err)
    });
  }

  calculateStats(): void {
    this.enAttenteCount = this.commandes.filter(c => c.statut === 'EN_ATTENTE' || c.statut === 'VALIDEE').length;
    this.enCoursCount = this.commandes.filter(c => c.statut === 'EN_LIVRAISON').length;
    this.livreeCount = this.commandes.filter(c => c.statut === 'LIVREE').length;
    this.annuleeCount = this.commandes.filter(c => c.statut === 'ANNULEE').length;
  }
}
