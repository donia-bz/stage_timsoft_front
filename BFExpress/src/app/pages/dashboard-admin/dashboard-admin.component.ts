import { Component, OnInit } from '@angular/core';
import { ApiService, Commande, Livreur } from '../../services/api.service';
import { AuthService, UserProfile } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-admin',
  templateUrl: './dashboard-admin.component.html',
  styleUrls: ['./dashboard-admin.component.scss']
})
export class DashboardAdminComponent implements OnInit {
  activeTab: 'commandes' | 'inscriptions' | 'livreurs' = 'commandes';
  commandes: Commande[] = [];
  livreurs: Livreur[] = [];
  usersList: UserProfile[] = [];

  // Selected driver for manual assignment mapped by order ID
  selectedDrivers: { [key: string]: string } = {};
  
  // AI assignment scores mapped by order ID for displaying prediction results
  aiPredictions: { [key: string]: { driverName: string; score: number } } = {};

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    // Fetch orders
    this.apiService.getAllCommandes().subscribe({
      next: (res) => this.commandes = res,
      error: (err) => console.error('Error fetching orders:', err)
    });

    // Fetch users (for approvals)
    this.authService.getAllUsers().subscribe({
      next: (res) => this.usersList = res,
      error: (err) => console.error('Error fetching users:', err)
    });

    // Fetch drivers
    this.apiService.getAllLivreurs().subscribe({
      next: (res) => this.livreurs = res,
      error: (err) => console.error('Error fetching drivers:', err)
    });
  }

  // Filter pending approvals - tous les utilisateurs sont approuvés par défaut maintenant
  getPendingApprovals(): UserProfile[] {
    return []; // Plus de filtre approuve
  }

  // Filter approved users - tous les utilisateurs sont approuvés
  getApprovedUsers(): UserProfile[] {
    return this.usersList;
  }

  // Approve a user - méthode conservée pour compatibilité mais ne fait rien
  approveUser(userId: string): void {
    // Plus nécessaire, tous les utilisateurs sont approuvés par défaut
    alert('Tous les utilisateurs sont approuvés par défaut.');
  }

  // Manual delivery driver assignment
  assignDriverManually(order: Commande): void {
    const driverId = this.selectedDrivers[order.id || ''];
    if (!driverId) {
      alert('Veuillez sélectionner un livreur.');
      return;
    }

    const orderId = order.id || '';
    this.apiService.creerLivraison(orderId, driverId).subscribe({
      next: (res) => {
        // Update order status to VALIDEE on successful assignment
        this.apiService.updateCommandeStatut(orderId, 'VALIDEE').subscribe({
          next: () => {
            // Also update driver status to "EN_COURS"
            this.apiService.updateLivreurStatut(driverId, 'EN_COURS').subscribe({
              next: () => {
                alert('Livreur affecté manuellement avec succès!');
                this.refreshData();
              }
            });
          }
        });
      },
      error: (err) => alert("Erreur d'affectation : " + err.message)
    });
  }

  // AI-optimized delivery driver assignment
  assignDriverAI(order: Commande): void {
    const orderId = order.id || '';
    if (!orderId) return;

    // Get available drivers
    const availableDrivers = this.livreurs.filter(l => l.statut === 'DISPONIBLE');
    if (availableDrivers.length === 0) {
      alert("Aucun livreur disponible pour l'affectation IA.");
      return;
    }

    // Call AI service to choose the best driver
    // We pass order id as commandeId, coordinates or fallback to default coordinates
    const lat = 36.8; // Coordonnées par défaut Tunis
    const lon = 10.1;

    this.apiService.affecterLivreur(orderId, lat, lon, availableDrivers).subscribe({
      next: (aiRes) => {
        const bestDriver = this.livreurs.find(l => l.id === aiRes.livreurId);
        if (!bestDriver) {
          alert('IA a recommandé un livreur introuvable.');
          return;
        }

        // Show AI prediction first
        this.aiPredictions[orderId] = {
          driverName: `${bestDriver.nom} ${bestDriver.prenom}`,
          score: aiRes.score
        };

        if (confirm(`L'IA recommande ${bestDriver.nom} ${bestDriver.prenom} (Score: ${aiRes.score * 100}%). Voulez-vous confirmer cette affectation automatique ?`)) {
          this.apiService.creerLivraison(orderId, bestDriver.id).subscribe({
            next: () => {
              this.apiService.updateCommandeStatut(orderId, 'VALIDEE').subscribe({
                next: () => {
                  this.apiService.updateLivreurStatut(bestDriver.id, 'EN_COURS').subscribe({
                    next: () => {
                      alert('Affectation IA validée et enregistrée!');
                      this.refreshData();
                    }
                  });
                }
              });
            },
            error: (err) => alert("Erreur lors de la livraison : " + err.message)
          });
        }
      },
      error: (err) => alert("Erreur de calcul IA : " + err.message)
    });
  }

  // Get order count by status
  getOrderCountByStatus(status: string): number {
    return this.commandes.filter(c => c.statut === status).length;
  }

  // Calculate total revenue
  getTotalRevenue(): number {
    return this.commandes
      .filter(c => c.statut === 'LIVREE')
      .reduce((sum, c) => sum + c.montantTotal, 0);
  }
}
