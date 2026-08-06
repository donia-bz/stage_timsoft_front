import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Livraison, Livreur, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-livreur',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard-livreur.component.html',
  styleUrls: ['./dashboard-livreur.component.scss']
})
export class DashboardLivreurComponent implements OnInit {
  // driver extras
  depotInfo: any = null;
  vehicleHistory: any[] = [];
  assignedVehicle: any = null;
  // new assignments notified by IA
  newAssignments: Livraison[] = [];
  // intervals
  private gpsInterval: any = null;
  private pollInterval: any = null;
  driverName = 'Livreur';
  driverId = '';
  driverInfo: Livreur | null = null;
  driverPhoto = '';
  livraisons: Livraison[] = [];
  commandesMap: { [colisId: string]: Commande } = {};
  activeTab: 'dashboard' | 'historique' | 'vehicule' | 'revenus' | 'parametres' = 'dashboard';
  deliveryHistory: any[] = [];
  notifications: any[] = [];

  stats = [
    { title: 'Courses du jour', value: 16, color: 'status-blue' },
    { title: 'À récupérer', value: 5, color: 'status-yellow' },
    { title: 'Livrés', value: 34, color: 'status-teal' },
    { title: 'Retours', value: 3, color: 'status-red' }
  ];

  successRate = 95;

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
  private driverMap: any = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.driverName = `${user.prenom} ${user.nom}`;
      this.driverId = user.id;
      this.loadDriverData();
      // poll for new assignments every 12s
      this.pollInterval = setInterval(() => this.checkForNewAssignments(), 12000);
      this.initMapDriver();
      // Load new features
      this.driverPhoto = localStorage.getItem('driverPhoto') || '';
      this.loadDeliveryHistory();
      this.loadNotifications();
    }
  }

  initMapDriver(): void {
    setTimeout(() => {
      const container = document.getElementById('driver-map');
      if (!container || (window as any).L === undefined) return;
      if (this.driverMap) {
        this.driverMap.remove();
        this.driverMap = null;
      }
      const L = (window as any).L;
      this.driverMap = L.map('driver-map').setView([this.latitude, this.longitude], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(this.driverMap);

      L.marker([this.latitude, this.longitude]).addTo(this.driverMap)
        .bindPopup(`<b>Position GPS Actuelle</b><br>${this.driverName}`)
        .openPopup();
    }, 300);
  }

  ngOnDestroy(): void {
    if (this.gpsInterval) clearInterval(this.gpsInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  uploadDriverPhoto(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.driverPhoto = e.target.result;
        localStorage.setItem('driverPhoto', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  loadDeliveryHistory(): void {
    // Simulated delivery history
    this.deliveryHistory = [
      { id: 'DEL001', date: '2024-08-07', client: 'Client A', statut: 'LIVREE', note: 5 },
      { id: 'DEL002', date: '2024-08-07', client: 'Client B', statut: 'LIVREE', note: 4 },
      { id: 'DEL003', date: '2024-08-06', client: 'Client C', statut: 'LIVREE', note: 5 },
      { id: 'DEL004', date: '2024-08-06', client: 'Client D', statut: 'RETARD', note: 3 },
      { id: 'DEL005', date: '2024-08-05', client: 'Client E', statut: 'LIVREE', note: 5 }
    ];
  }

  loadNotifications(): void {
    // Simulated notifications
    this.notifications = [
      { id: 1, type: 'NEW_ORDER', message: 'Nouvelle commande affectée', time: 'Il y a 5 min', read: false },
      { id: 2, type: 'REMINDER', message: 'Maintenance véhicule prévue', time: 'Il y a 1h', read: false },
      { id: 3, type: 'INFO', message: 'Statut du jour mis à jour', time: 'Il y a 2h', read: true }
    ];
  }

  // Helper methods for template bindings
  getUnreadNotificationCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  isNotificationUnread(notif: any): boolean {
    return !notif.read;
  }

  getNotificationIcon(notif: any): string {
    if (notif.type === 'NEW_ORDER') return '📦';
    if (notif.type === 'REMINDER') return '⏰';
    if (notif.type === 'INFO') return 'ℹ️';
    return '📢';
  }

  getDeliveryRefShort(delivery: any): string {
    if (!delivery || !delivery.id) return 'N/A';
    return '#' + delivery.id.substring(delivery.id.length - 6);
  }

  getDeliveryStatutClass(statut: string): string {
    return statut.toLowerCase();
  }

  getLivraisonRefShort(livraison: any): string {
    if (!livraison || !livraison.id) return 'N/A';
    return '#' + livraison.id.substring(livraison.id.length - 6);
  }

  getDeliveryDestination(): string {
    return this.currentDeliveryCommande?.adresseArrivee?.ville || 'Adresse Destinataire';
  }

  getDeliveryClient(): string {
    return this.currentDeliveryCommande?.clientNom || 'Client BFExpress';
  }

  getStatsValue(): number {
    return this.stats[0]?.value || 0;
  }

  getDriverNote(): string {
    return String(this.driverInfo?.noteMoyenne || '4.9');
  }

  getDeliveryId(delivery: any): string {
    return delivery.id || 'N/A';
  }

  getDeliveryDate(delivery: any): string {
    return delivery.date || '';
  }

  getDeliveryClientName(delivery: any): string {
    return delivery.client || '';
  }

  getDeliveryStatut(delivery: any): string {
    return delivery.statut || '';
  }

  getDeliveryNote(delivery: any): number {
    return delivery.note || 0;
  }

  isTabHistorique(): boolean {
    return this.activeTab === 'historique';
  }

  isTabRevenus(): boolean {
    return this.activeTab === 'revenus';
  }

  isTabParametres(): boolean {
    return this.activeTab === 'parametres';
  }

  isDriverAvailable(): boolean {
    return this.driverInfo?.statut === 'DISPONIBLE' || this.driverInfo?.statut === 'EN_COURSE';
  }

  isDriverOffline(): boolean {
    return this.driverInfo?.statut === 'HORS_LIGNE';
  }

  isDriverStatusAvailable(): boolean {
    return this.driverInfo?.statut === 'DISPONIBLE';
  }

  isDriverStatusBusy(): boolean {
    return this.driverInfo?.statut === 'EN_COURSE';
  }

  isDriverStatusOffline(): boolean {
    return this.driverInfo?.statut === 'HORS_LIGNE';
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
        // detect assignments awaiting acceptance
        this.newAssignments = this.livraisons.filter(l => l.statut === 'affectee');
        // compute driver stats
        this.computeDriverStats();
        // start GPS streaming if a delivery is in progress
        if (this.currentDelivery) this.startGPSStream();
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
        // silent success in streaming mode
        console.debug(`GPS updated: (${this.latitude}, ${this.longitude})`);
      },
      error: (err) => alert('Erreur lors de la mise à jour GPS')
    });
  }

  startGPSStream() {
    if (this.gpsInterval) return;
    // send GPS every 10 seconds while in delivery
    this.gpsInterval = setInterval(() => {
      if (this.currentDelivery && this.currentDelivery.statut === 'en_cours') {
        this.updateGPS();
      } else {
        clearInterval(this.gpsInterval);
        this.gpsInterval = null;
      }
    }, 10000);
  }

  checkForNewAssignments() {
    if (!this.driverId) return;
    this.apiService.getLivraisonsByLivreur(this.driverId).subscribe({
      next: (res) => {
        const awaiting = res.filter(l => l.statut === 'affectee');
        // new items not present in previous list
        const idsNow = awaiting.map(a => a.id);
        const idsOld = this.newAssignments.map(a => a.id);
        const newly = awaiting.filter(a => !idsOld.includes(a.id));
        if (newly.length) {
          this.newAssignments = awaiting;
          // simple browser notification (in-app)
          newly.forEach(n => alert(`Nouvelle affectation: livraison ${n.id}. Ouvrez la file d'attente pour accepter.`));
        }
      }
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
            this.startGPSStream();
          }
        });
      },
      error: (err) => alert('Erreur au démarrage : ' + err.message)
    });
  }

  // Accept an assignment (starts the course immediately)
  acceptAssignment(livraison: Livraison) {
    if (!confirm('Accepter cette course ?')) return;
    this.demarrer(livraison);
  }

  // Compute per-driver statistics
  computeDriverStats() {
    if (!this.driverId) return;
    this.apiService.getLivraisonsByLivreur(this.driverId).subscribe({
      next: (livs) => {
        const total = livs.length;
        const done = livs.filter(l => l.statut === 'livree').length;
        const failed = livs.filter(l => l.statut === 'echoue' || l.statut === 'ECHOUEE').length;
        const successRate = total ? Math.round((done / total) * 100) : 100;
        // average rating comes from driver profile
        const avgNote = this.driverInfo?.noteMoyenne || 5.0;
        // update KPIs
        this.stats[0].value = total;
        this.stats[1].value = avgNote;
        // extend stats display
        this.stats[2].value = Math.round((done || 0) * 1); // placeholder distance
        // optional expose successRate
        (this as any).successRate = successRate;
      }
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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  reportIssue(livraison: Livraison): void {
    // Navigate to claims page with pre-filled data
    this.router.navigate(['/reclamations'], {
      queryParams: { livraisonId: livraison.id }
    });
  }
}
