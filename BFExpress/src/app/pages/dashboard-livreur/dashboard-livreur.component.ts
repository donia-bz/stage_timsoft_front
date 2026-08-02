import { Component, OnInit } from '@angular/core';
import { ApiService, Livraison, Livreur, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-livreur',
  templateUrl: './dashboard-livreur.component.html',
  styleUrls: ['./dashboard-livreur.component.scss']
})
export class DashboardLivreurComponent implements OnInit {
  driverName = 'Livreur';
  driverId = '';
  driverInfo: Livreur | null = null;
  livraisons: Livraison[] = [];
  commandesMap: { [colisId: string]: Commande } = {};

  stats = [
    { title: 'Courses du jour', value: 16, color: 'status-blue' },
    { title: 'À récupérer', value: 5, color: 'status-yellow' },
    { title: 'Livrés', value: 34, color: 'status-teal' },
    { title: 'Retours', value: 3, color: 'status-red' }
  ];

  currentDelivery?: Livraison;

  get currentDeliveryCommande(): Commande | undefined {
    return this.currentDelivery ? this.commandesMap[this.currentDelivery.colisId] : undefined;
  }

  get isDeliveryInProgress(): boolean {
    return this.livraisons.some(item => item.statut === 'en_cours');
  }

  get waitingLivraisons(): Livraison[] {
    return this.livraisons.filter(item => item.statut === 'affectee');
  }

  quickActions = [
    { label: 'Nouvelle collecte', route: '/ajout-colis' },
    { label: 'Suivi colis', route: '/recherche-colis' },
    { label: 'Signaler incident', route: '/reclamations' }
  ];

  schedule = [
    { time: '08:30', task: 'Prise en charge colis N°3179', status: 'En cours' },
    { time: '10:00', task: 'Livraison colis N°4062', status: 'Prévu' },
    { time: '11:45', task: 'Retour dépôt', status: 'Prévu' }
  ];

  latitude = 36.8065;
  longitude = 10.1815;

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.driverName = `${user.prenom} ${user.nom}`;
      this.driverId = user.id;
      this.loadDriverData();
    }
  }

  loadDriverData(): void {
    if (!this.driverId) return;

    // Load driver profile
    this.apiService.getLivreurById(this.driverId).subscribe({
      next: (res) => {
        this.driverInfo = res;
        this.latitude = res.latitudeActuelle || 36.8065;
        this.longitude = res.longitudeActuelle || 10.1815;
      },
      error: (err) => console.error('Error fetching driver profile:', err)
    });

    // Load assigned deliveries
    this.apiService.getLivraisonsByLivreur(this.driverId).subscribe({
      next: (res) => {
        this.livraisons = res;
        this.currentDelivery = this.livraisons.find(l => l.statut === 'en_cours');
        // Fetch command details for each delivery
        this.livraisons.forEach(l => {
          if (l.colisId && !this.commandesMap[l.colisId]) {
            this.apiService.getCommandeById(l.colisId).subscribe({
              next: (cmd) => this.commandesMap[l.colisId] = cmd,
              error: (e) => console.error(e)
            });
          }
        });
      },
      error: (err) => console.error('Error fetching driver deliveries:', err)
    });
  }

  toggleStatut(newStatut: string): void {
    if (!this.driverId) return;
    this.apiService.updateLivreurStatut(this.driverId, newStatut).subscribe({
      next: (res) => {
        if (this.driverInfo) this.driverInfo.statut = res.statut;
        alert(`Votre statut est maintenant : ${newStatut}`);
      },
      error: (err) => alert('Erreur lors du changement de statut')
    });
  }

  updateGPS(): void {
    if (!this.driverId) return;
    this.apiService.updateLivreurPosition(this.driverId, this.latitude, this.longitude).subscribe({
      next: (res) => {
        alert(`Position GPS mise à jour : (${this.latitude}, ${this.longitude})`);
      },
      error: (err) => alert('Erreur lors de la mise à jour GPS')
    });
  }

  demarrer(livraison: Livraison): void {
    this.apiService.demarrerLivraison(livraison.id).subscribe({
      next: (updatedLiv) => {
        livraison.statut = 'en_cours';
        // Also update order status
        this.apiService.updateCommandeStatut(livraison.colisId, 'EN_LIVRAISON').subscribe({
          next: () => {
            alert('Course démarrée ! La commande est maintenant en cours de livraison.');
            this.loadDriverData();
          }
        });
      },
      error: (err) => alert('Erreur au démarrage : ' + err.message)
    });
  }

  terminer(livraison: Livraison): void {
    this.apiService.terminerLivraison(livraison.id).subscribe({
      next: (updatedLiv) => {
        livraison.statut = 'livree';
        // Update order status to LIVREE
        this.apiService.updateCommandeStatut(livraison.colisId, 'LIVREE').subscribe({
          next: () => {
            // Reset driver status to disponible
            this.apiService.updateLivreurStatut(this.driverId, 'DISPONIBLE').subscribe({
              next: () => {
                alert('Livraison terminée avec succès ! Félicitations.');
                this.loadDriverData();
              }
            });
          }
        });
      },
      error: (err) => alert('Erreur lors de la clôture de la livraison : ' + err.message)
    });
  }
}
