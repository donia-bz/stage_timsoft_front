import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Commande, Livreur } from '../../services/api.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard-admin-enhanced.component.html',
  styleUrls: ['./dashboard-admin-enhanced.component.scss']
})
export class DashboardAdminComponent implements OnInit {
  activeTab: 'commandes' | 'inscriptions' | 'livreurs' | 'depots' | 'vehicules' | 'carte' | 'stats' = 'commandes';
  commandes: Commande[] = [];
  livreurs: Livreur[] = [];
  usersList: UserProfile[] = [];
  depots: any[] = [];
  vehicules: any[] = [];

  // Stats and history
  deliveriesHistory: any[] = [];
  showHistoryPanel = false;
  historyForOrderId: string | null = null;
  stats: any = { avgDeliveryMin: 0, avgDelayMin: 0, commandesCount: 0, revenus: 0, driverPerformance: {} };

  // Selected driver for manual assignment mapped by order ID
  selectedDrivers: { [key: string]: string } = {};

  // AI assignment scores mapped by order ID for displaying prediction results
  aiPredictions: { [key: string]: { driverName: string; score: number } } = {};

  // Assignment panel state
  assignmentPanelOrderId: string | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
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

    // Load persisted depots/vehicules from localStorage as a fallback
    try {
      const d = localStorage.getItem('bf_depots');
      const v = localStorage.getItem('bf_vehicules');
      this.depots = d ? JSON.parse(d) : [];
      this.vehicules = v ? JSON.parse(v) : [];
    } catch (e) {
      this.depots = [];
      this.vehicules = [];
    }

    // Compute statistics after loading commandes and livraisons
    this.computeStats();
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

  // Open history panel for a given order
  openHistory(order: Commande): void {
    const orderId = order.id || '';
    this.historyForOrderId = orderId;
    this.showHistoryPanel = true;
    this.deliveriesHistory = [];

    // get all livraisons and filter by commandeId
    this.apiService.getAllLivraisons().subscribe({
      next: (livs) => {
        const related = livs.filter(l => l.commandeId === orderId);
        const withPositionsPromises = related.map(l => {
          return new Promise((resolve) => {
            this.apiService.getPositions(l.id).subscribe({
              next: (positions) => resolve({ livraison: l, positions }),
              error: () => resolve({ livraison: l, positions: [] })
            });
          });
        });

        Promise.all(withPositionsPromises).then((res: any) => {
          this.deliveriesHistory = res;
        });
      },
      error: (err) => {
        console.error('Erreur récupération livraisons:', err);
      }
    });
  }

  closeHistory(): void {
    this.showHistoryPanel = false;
    this.historyForOrderId = null;
    this.deliveriesHistory = [];
  }

  // Simple depot/vehicle CRUD stored in localStorage until backend exists
  addDepot(nom: string, ville: string, capacite: number) {
    const depot = { id: 'DEP' + Date.now(), nom, ville, capacite };
    this.depots.push(depot);
    localStorage.setItem('bf_depots', JSON.stringify(this.depots));
  }

  removeDepot(id: string) {
    this.depots = this.depots.filter(d => d.id !== id);
    localStorage.setItem('bf_depots', JSON.stringify(this.depots));
  }

  addVehicule(immatriculation: string, modele: string, capacite: number) {
    const v = { id: 'VEH' + Date.now(), immatriculation, modele, capacite };
    this.vehicules.push(v);
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
  }

  removeVehicule(id: string) {
    this.vehicules = this.vehicules.filter(v => v.id !== id);
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
  }

  // Compute basic statistics from commandes + livraisons
  computeStats() {
    // compute revenue and counts
    const commandes = this.commandes || [];
    this.stats.commandesCount = commandes.length;
    this.stats.revenus = this.getTotalRevenue();

    // compute average delivery duration from livraisons
    this.apiService.getAllLivraisons().subscribe({
      next: (livs) => {
        const finished = livs.filter(l => l.dateDebut && l.dateFin);
        const durations = finished.map(l => (new Date(l.dateFin!).getTime() - new Date(l.dateDebut!).getTime()) / 60000);
        this.stats.avgDeliveryMin = durations.length ? (durations.reduce((a,b) => a+b,0)/durations.length) : 0;

        // driver performance: deliveries completed and average time
        const byDriver: any = {};
        livs.forEach(l => {
          const d = l.livreurId || 'unknown';
          if (!byDriver[d]) byDriver[d] = { count: 0, totalMin: 0 };
          if (l.dateDebut && l.dateFin) {
            const mins = (new Date(l.dateFin).getTime() - new Date(l.dateDebut).getTime())/60000;
            byDriver[d].count += 1;
            byDriver[d].totalMin += mins;
          }
        });
        Object.keys(byDriver).forEach(k => {
          byDriver[k].avgMin = byDriver[k].count ? byDriver[k].totalMin / byDriver[k].count : 0;
        });
        this.stats.driverPerformance = byDriver;
      },
      error: (err) => console.error('Erreur stats livraisons', err)
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

  // Get order percentage by status
  getOrderPercentage(status: string): number {
    const total = this.commandes.length;
    if (total === 0) return 0;
    return (this.getOrderCountByStatus(status) / total) * 100;
  }

  // Toggle driver status
  toggleDriverStatus(driver: Livreur): void {
    const newStatus = driver.statut === 'DISPONIBLE' ? 'HORS_LIGNE' : 'DISPONIBLE';
    this.apiService.updateLivreurStatut(driver.id, newStatus).subscribe({
      next: (res) => {
        driver.statut = res.statut;
        alert(`Statut du livreur mis à jour: ${newStatus}`);
      },
      error: (err) => alert('Erreur lors de la mise à jour du statut')
    });
  }

  // Random position for map demo
  randomPosition(): number {
    return Math.random() * 80 + 10;
  }

  // Helper methods for template
  formatPosition(lat: number, lon: number): string {
    if (!lat || !lon) return 'Non disponible';
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  getDriverDeliveryCount(driverId: string): number {
    return this.stats.driverPerformance[driverId]?.count || 0;
  }

  round(value: number): number {
    return Math.round(value);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    return new Date(date).toLocaleString('fr-FR');
  }

  getAvailableDriversCount(): number {
    return this.livreurs.filter(l => l.statut === 'DISPONIBLE').length;
  }

  getTopDrivers(): any[] {
    return this.livreurs.slice(0, 5);
  }

  showAssignmentPanel(order: Commande): void {
    this.assignmentPanelOrderId = order.id || null;
  }

  closeAssignmentPanel(): void {
    this.assignmentPanelOrderId = null;
  }

  // Logout
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
