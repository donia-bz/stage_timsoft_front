import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Livraison, Livreur, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { WebsocketSyncService } from '../../services/websocket-sync.service';
import { NotificationService } from '../../services/notification.service';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface DeliveryStats {
  toPickup: number;
  inProgress: number;
  deliveredToday: number;
  failedToday: number;
  rating: number;
}

interface Earnings {
  today: number;
  week: number;
  month: number;
}

type DriverTab = 'accueil' | 'tournee' | 'carte' | 'gains' | 'profil';

type TourneeFilter = 'all' | 'to_pickup' | 'picked_up' | 'in_progress' | 'completed' | 'failed';

@Component({
  selector: 'app-dashboard-livreur',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard-livreur.component.html',
  styleUrls: ['./dashboard-livreur.component.scss']
})
export class DashboardLivreurComponent implements OnInit, OnDestroy {

  activeTab: DriverTab = 'accueil';
  sidebarCollapsed = false;
  user: any = null;
  searchQuery = '';
  showMenu: boolean = false;
  showNotifications: boolean = false;
  unreadCount: number = 0;

  // Filtres avancés
  filterGouvernorat = '';
  filterDate = '';
  filterMinCOD = 0;
  filterMaxCOD = 0;

  // Tri
  sortBy: 'date' | 'distance' | 'priority' | 'cod' = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Gains et statistiques
  earningsHistory: { date: string; amount: number; deliveries: number }[] = [];
  statsView: 'day' | 'week' = 'day';

  get dailyProgress(): number {
    const total = this.livraisons.length;
    const completed = this.getCompletedList().length;
    return total > 0 ? (completed / total) * 100 : 0;
  }

  driverName = 'Livreur';
  driverId = '';
  driverInfo: Livreur | null = null;
  driverPhoto = '';
  driverStatus: 'DISPONIBLE' | 'EN_COURSE' | 'HORS_LIGNE' = 'DISPONIBLE';

  livraisons: Livraison[] = [];
  commandesMap: { [commandeId: string]: Commande } = {};
  colisMap: { [colisId: string]: any } = {};
  newAssignments: Livraison[] = [];
  currentDelivery: Livraison | null = null;
  activeDeliveryView: Livraison | null = null;

  loading = false;
  searchColisId = '';
  foundColis: Commande | null = null;
  searchError = '';

  earnings: Earnings = { today: 0, week: 0, month: 0 };

  vehicleInfo: any = {
    marque: '',
    modele: '',
    immatriculation: '',
    type: 'Voiture'
  };

  assignedVehicles: any[] = [];

  notificationsEnabled = true;

  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;

  latitude = 36.8065;
  longitude = 10.1815;
  private gpsInterval: any = null;
  private pollInterval: any = null;
  private driverMap: any = null;
  private activeDeliveryMap: any = null;

  deliveryProgressSteps = [
    { key: 'A_ENLEVER', label: 'À enlever' },
    { key: 'ENLEVE', label: 'Enlevé' },
    { key: 'EN_LIVRAISON', label: 'En route' },
    { key: 'LIVRE', label: 'Livré' }
  ];

  trackingSteps = [
    { key: 'EN_ATTENTE', label: 'En attente' },
    { key: 'MANIFESTE', label: 'Sur manifeste' },
    { key: 'A_ENLEVER', label: 'À enlever' },
    { key: 'ENLEVE', label: 'Enlevé' },
    { key: 'AU_DEPOT', label: 'Au dépôt' },
    { key: 'EN_LIVRAISON', label: 'En livraison' },
    { key: 'LIVRE', label: 'Livré' },
    { key: 'LIVRE_PAYE', label: 'Livré & payé' },
    { key: 'ECHEC_LIVRAISON', label: 'Échec livraison' },
    { key: 'RETOUR_DEPOT', label: 'Retour dépôt' },
    { key: 'RETOUR_EXPEDITEUR', label: 'Retour expéditeur' },
    { key: 'ANNULEE', label: 'Annulée' }
  ];

  failureReasons = [
    'ABSENT',
    'REFUS',
    'ADRESSE_ERRONEE',
    'DESTINATAIRE_INJOIGNABLE',
    'COLIS_ENDOMMAGE',
    'AUTRE'
  ];

  showFailureModal = false;
  selectedDelivery: Livraison | null = null;
  selectedFailureReason = '';
  failureDescription = '';

  tourneeFilter: TourneeFilter = 'all';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private websocketSync: WebsocketSyncService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = user;
    this.driverName = 'Livreur';
    this.driverId = user.id;

    // Photo et notifications gardées en localStorage (préférences UI)
    this.driverPhoto = localStorage.getItem('driverPhoto') || '';
    this.notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
    // Véhicule chargé depuis le backend (pas de localStorage)
    this.loadVehicleInfo();
    this.loadDriverData();
    this.startPolling();
    this.initializeRealtimeSync();
    this.notificationService.loadNotifications();
  }

  ngOnDestroy(): void {
    if (this.gpsInterval) clearInterval(this.gpsInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.destroyMap(this.driverMap);
    this.driverMap = null;
    this.destroyMap(this.activeDeliveryMap);
    this.activeDeliveryMap = null;
    this.websocketSync.disconnectAll();
  }

  // ========== NAVIGATION ==========
  setTab(tab: DriverTab): void {
    this.closeActiveDelivery();
    this.activeTab = tab;
    if (tab === 'carte') {
      setTimeout(() => this.initMap('driver-map'), 150);
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleMenu(): void {
    this.showMenu = !this.showMenu;
    this.showNotifications = false;
  }

  toggleNotificationsMenu(): void {
    this.showNotifications = !this.showNotifications;
    this.showMenu = false;
  }

  closeMenu(): void {
    this.showMenu = false;
    this.showNotifications = false;
  }

  logoutFromTopbar(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  setTourneeFilter(filter: TourneeFilter): void {
    this.tourneeFilter = filter;
  }

  goToTournee(filter: TourneeFilter = 'all'): void {
    this.tourneeFilter = filter;
    this.setTab('tournee');
  }

  openActiveDelivery(livraison: Livraison): void {
    this.activeDeliveryView = livraison;
    setTimeout(() => this.initActiveDeliveryMap(), 150);
  }

  closeActiveDelivery(): void {
    this.activeDeliveryView = null;
    this.destroyMap(this.activeDeliveryMap);
    this.activeDeliveryMap = null;
  }

  getActiveTourneeCount(): number {
    return this.getToPickupList().length + this.getPickedUpList().length + this.getInProgressList().length;
  }

  getNextActionDelivery(): Livraison | null {
    return this.getInProgressList()[0] || this.getPickedUpList()[0] || this.getToPickupList()[0] || null;
  }

  // ========== DATA ==========
  loadDriverData(): void {
    if (!this.driverId) return;
    this.loading = true;

    this.apiService.getLivreurById(this.driverId).subscribe({
      next: (driver) => {
        this.driverInfo = driver;
        if (driver?.statut === 'DISPONIBLE' || driver?.statut === 'EN_COURSE' || driver?.statut === 'HORS_LIGNE') {
          this.driverStatus = driver.statut as any;
        }
        if (driver?.latitudeActuelle) this.latitude = driver.latitudeActuelle;
        if (driver?.longitudeActuelle) this.longitude = driver.longitudeActuelle;
        this.loadLivraisons();
      },
      error: (err) => {
        console.error('Error loading driver:', err);
        this.loading = false;
        this.showToast('Erreur chargement profil livreur', 'error');
        this.loadLivraisons();
      }
    });
  }

  loadLivraisons(): void {
    if (!this.driverId) return;

    console.log('=== CHARGEMENT LIVRAISONS LIVREUR ===');
    console.log('Driver ID:', this.driverId);
    console.log('Tracking URL:', this.apiService['trackingUrl']);

    this.apiService.getLivraisonsByLivreur(this.driverId).subscribe({
      next: (livraisons) => {
        console.log('Livraisons reçues:', livraisons);
        console.log('Nombre de livraisons:', livraisons?.length || 0);
        this.livraisons = livraisons || [];
        this.loadCommandesDetails();
        this.updateCurrentDelivery();
        this.calculateEarnings();
        this.calculateEarningsHistory();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading deliveries:', err);
        this.livraisons = [];
        this.loading = false;
      }
    });
  }

  loadCommandesDetails(): void {
    const colisIds = this.livraisons
      .map(l => l.colisId)
      .filter((id): id is string => !!id && !this.colisMap[id]);

    colisIds.forEach(id => {
      this.apiService.getColisById(id).subscribe({
        next: (colis) => {
          this.colisMap[id] = colis;
          const commandeId = colis?.commandeId;
          if (commandeId && !this.commandesMap[commandeId]) {
            this.fetchCommande(commandeId);
          }
          this.updateCurrentDelivery();
          this.calculateEarnings();
        },
        error: (err) => {
          console.error('Error loading colis', id, err);
          this.colisMap[id] = { id, statut: 'EN_ATTENTE', poids: 0 };
        }
      });
    });

    const commandeIds = this.livraisons
      .map(l => this.getLinkedCommandeId(l))
      .filter((id): id is string => !!id && !this.commandesMap[id]);

    commandeIds.forEach(id => this.fetchCommande(id));
  }

  private fetchCommande(id: string): void {
    this.apiService.getCommandeById(id).subscribe({
      next: (cmd) => {
        this.commandesMap[id] = cmd;
      },
      error: (err) => console.error('Error loading commande', id, err)
    });
  }

  private getLinkedCommandeId(livraison: Livraison): string {
    if (livraison.commandeId) return livraison.commandeId;
    const colis = this.colisMap[livraison.colisId];
    if (colis?.commandeId) return colis.commandeId;
    // Fallback if the colisId is actually the commandeId itself (old entries)
    if (livraison.colisId && (!colis || !colis.commandeId)) {
      return livraison.colisId;
    }
    return '';
  }

  getCommandeForLivraison(livraison: Livraison): Commande | undefined {
    return this.getCommande(this.getLinkedCommandeId(livraison));
  }

  getColis(colisId: string): any {
    return this.colisMap[colisId];
  }

  getColisStatut(colisId: string): string {
    return this.colisMap[colisId]?.statut || 'EN_ATTENTE';
  }

  updateCurrentDelivery(): void {
    this.currentDelivery =
      this.livraisons.find(l => {
        const statut = this.getColisStatut(l.colisId);
        return statut === 'EN_LIVRAISON' || l.statut === 'en_cours' || l.statut === 'EN_COURS';
      }) || null;

    if (this.currentDelivery) {
      this.startGPS();
    } else {
      this.stopGPS();
    }
  }

  // ========== POLLING ==========
  startPolling(): void {
    this.pollInterval = setInterval(() => this.checkForNewAssignments(), 12000);
  }

  checkForNewAssignments(): void {
    if (!this.driverId) return;

    this.apiService.getLivraisonsByLivreur(this.driverId).subscribe({
      next: (livraisons) => {
        const incoming = livraisons || [];
        const oldIds = new Set(this.livraisons.map(l => l.id));
        const newly = incoming.filter(l => l.id && !oldIds.has(l.id));

        if (newly.length > 0) {
          this.newAssignments = newly;
          this.showToast(`${newly.length} nouvelle(s) course(s) affectée(s)`, 'info');
        }

        this.livraisons = incoming;
        this.loadCommandesDetails();
        this.updateCurrentDelivery();
        this.calculateEarnings();
      },
      error: (err) => console.error('Polling error:', err)
    });
  }

  // ========== GPS ==========
  startGPS(): void {
    if (this.gpsInterval) return;

    this.gpsInterval = setInterval(() => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.latitude = position.coords.latitude;
          this.longitude = position.coords.longitude;
          this.updateDriverPosition();
          if (this.activeTab === 'carte') {
            this.updateMapMarker(this.driverMap);
          }
          if (this.activeDeliveryView) {
            this.updateMapMarker(this.activeDeliveryMap);
          }
        },
        (error) => console.error('GPS error:', error),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }, 10000);
  }

  stopGPS(): void {
    if (this.gpsInterval) {
      clearInterval(this.gpsInterval);
      this.gpsInterval = null;
    }
  }

  updateDriverPosition(): void {
    if (!this.driverId) return;
    this.apiService.updateLivreurPosition(this.driverId, this.latitude, this.longitude).subscribe({
      error: (err) => console.error('Error updating position:', err)
    });
  }

  // ========== MAP ==========
  private destroyMap(map: any): void {
    if (map) {
      try { map.remove(); } catch {}
    }
  }

  initMap(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container || (window as any).L === undefined) return;

    const L = (window as any).L;

    if (containerId === 'driver-map') {
      this.destroyMap(this.driverMap);
      this.driverMap = null;
    }

    const map = L.map(containerId).setView([this.latitude, this.longitude], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    this.addDriverMarkerToMap(map);
    this.addDestinationMarkersToMap(map);

    if (containerId === 'driver-map') {
      this.driverMap = map;
    }

    setTimeout(() => {
      try { map?.invalidateSize(); } catch {}
    }, 200);
  }

  initActiveDeliveryMap(): void {
    if (!this.activeDeliveryView) return;

    const container = document.getElementById('active-delivery-map');
    if (!container || (window as any).L === undefined) return;

    const L = (window as any).L;
    this.destroyMap(this.activeDeliveryMap);
    this.activeDeliveryMap = null;

    const dest = this.getDestinationCoords(this.activeDeliveryView);
    const centerLat = dest ? (this.latitude + dest.lat) / 2 : this.latitude;
    const centerLng = dest ? (this.longitude + dest.lng) / 2 : this.longitude;

    const map = L.map('active-delivery-map').setView([centerLat, centerLng], dest ? 13 : 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    this.addDriverMarkerToMap(map);

    if (dest) {
      L.marker([dest.lat, dest.lng], {
        icon: L.divIcon({
          className: 'destination-marker',
          html: '<div style="font-size:18px">🏁</div>',
          iconSize: [28, 28]
        })
      })
        .addTo(map)
        .bindPopup(`<b>Destination</b><br>${dest.label}`);
    }

    this.activeDeliveryMap = map;

    setTimeout(() => {
      try { map?.invalidateSize(); } catch {}
      if (dest) {
        const bounds = L.latLngBounds([[this.latitude, this.longitude], [dest.lat, dest.lng]]);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }, 200);
  }

  private addDriverMarkerToMap(map: any): void {
    const L = (window as any).L;
    L.marker([this.latitude, this.longitude], {
      icon: L.divIcon({
        className: 'driver-marker',
        html: '<div style="font-size:22px">🚚</div>',
        iconSize: [30, 30]
      })
    })
      .addTo(map)
      .bindPopup(`<b>${this.driverName}</b><br>Position actuelle`);
  }

  private addDestinationMarkersToMap(map: any): void {
    const L = (window as any).L;

    this.getActiveDeliveries().forEach((livraison) => {
      const dest = this.getDestinationCoords(livraison);
      if (!dest) return;

      L.marker([dest.lat, dest.lng], {
        icon: L.divIcon({
          className: 'destination-marker',
          html: '<div style="font-size:18px">📦</div>',
          iconSize: [28, 28]
        })
      })
        .addTo(map)
        .bindPopup(`<b>${dest.recipient}</b><br>${dest.label}`);
    });
  }

  updateMapMarker(map: any): void {
    if (!map) return;
    map.setView([this.latitude, this.longitude], map.getZoom() || 12);
  }

  getDestinationCoords(livraison: Livraison): { lat: number; lng: number; label: string; recipient: string } | null {
    const commande = this.getCommandeForLivraison(livraison);
    const addr = commande?.adresseArrivee;
    const lat = addr?.latitude;
    const lng = addr?.longitude;

    if (lat == null || lng == null) return null;

    return {
      lat,
      lng,
      label: this.getCommandeFullAddress(commande),
      recipient: this.getCommandeDestinataire(commande)
    };
  }

  openNavigation(livraison: Livraison): void {
    const dest = this.getDestinationCoords(livraison);
    if (!dest) {
      const commande = this.getCommandeForLivraison(livraison);
      const address = encodeURIComponent(this.getCommandeFullAddress(commande));
      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
      return;
    }
    window.open(`https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`, '_blank');
  }

  callClient(livraison: Livraison): void {
    const phone = this.getCommandePhone(this.getCommandeForLivraison(livraison));
    if (!phone || phone === '—') {
      this.showToast('Numéro de téléphone indisponible', 'error');
      return;
    }
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
  }

  // ========== STATUS ==========
  toggleStatut(newStatus: string): void {
    if (!this.driverId) return;

    this.apiService.updateLivreurStatut(this.driverId, newStatus).subscribe({
      next: (res) => {
        this.driverStatus = (res?.statut || newStatus) as any;
        if (this.driverInfo) this.driverInfo.statut = this.driverStatus;
        this.showToast(`Statut : ${newStatus}`, 'success');
      },
      error: () => {
        this.driverStatus = newStatus as any;
        if (this.driverInfo) this.driverInfo.statut = this.driverStatus;
        this.showToast(`Statut local : ${newStatus}`, 'info');
      }
    });
  }

  // ========== ACTIONS METIER ==========
  validerEnlevement(livraison: Livraison): void {
    const colisId = livraison.colisId;
    if (!colisId) {
      this.showToast('Colis introuvable', 'error');
      return;
    }

    this.loading = true;
    this.apiService.updateColisStatut(colisId, 'ENLEVE').subscribe({
      next: () => {
        if (this.colisMap[colisId]) {
          this.colisMap[colisId].statut = 'ENLEVE';
        }
        this.toggleStatut('EN_COURSE');
        this.showToast('Enlèvement validé — colis récupéré', 'success');
        this.loading = false;
        this.loadLivraisons();
        this.openActiveDelivery(livraison);
      },
      error: (err) => {
        console.error('Erreur validation enlèvement:', err);
        this.loading = false;
        this.showToast('Erreur validation (vérifiez le backend)', 'error');
      }
    });
  }

  terminerLivraison(livraison: Livraison): void {
    const colisId = livraison.colisId;
    if (!colisId) {
      this.showToast('Colis introuvable', 'error');
      return;
    }

    const commande = this.getCommandeForLivraison(livraison);
    const montant = commande?.montantTotal || 0;
    const finalStatus = montant > 0 ? 'LIVRE_PAYE' : 'LIVRE';

    if (!confirm(`Confirmer la livraison en statut ${finalStatus} ?`)) return;

    this.loading = true;

    this.apiService.updateColisStatut(colisId, finalStatus).subscribe({
      next: () => {
        if (this.colisMap[colisId]) {
          this.colisMap[colisId].statut = finalStatus;
        }
        this.showToast('Livraison terminée', 'success');
        this.loading = false;
        this.closeActiveDelivery();
        this.toggleStatut('DISPONIBLE');
        this.loadLivraisons();

        // Envoyer notification WhatsApp au client
        this.sendWhatsAppDeliveredNotification(livraison);
      },
      error: () => {
        this.loading = false;
        this.showToast('Erreur clôture livraison', 'error');
      }
    });
  }

  showFailureModalFor(livraison: Livraison): void {
    this.selectedDelivery = livraison;
    this.selectedFailureReason = '';
    this.failureDescription = '';
    this.showFailureModal = true;
  }

  annulerEchec(): void {
    this.showFailureModal = false;
    this.selectedDelivery = null;
    this.selectedFailureReason = '';
    this.failureDescription = '';
  }

  confirmerEchec(): void {
    if (!this.selectedDelivery || !this.selectedFailureReason) {
      this.showToast('Motif obligatoire', 'error');
      return;
    }

    const colisId = this.selectedDelivery.colisId;
    if (!colisId) {
      this.showToast('Colis introuvable', 'error');
      return;
    }

    this.loading = true;
    this.apiService.updateColisStatut(colisId, 'ECHEC_LIVRAISON', this.selectedFailureReason, this.failureDescription).subscribe({
      next: () => {
        if (this.colisMap[colisId]) {
          this.colisMap[colisId].statut = 'ECHEC_LIVRAISON';
          this.colisMap[colisId].raisonEchec = this.selectedFailureReason;
          this.colisMap[colisId].descriptionEchec = this.failureDescription;
        }
        this.showFailureModal = false;
        this.showToast(`Échec enregistré (${this.selectedFailureReason})`, 'success');
        this.loading = false;
        this.closeActiveDelivery();
        this.toggleStatut('DISPONIBLE');
        this.loadLivraisons();

        // Envoyer notification WhatsApp au client
        if (this.selectedDelivery) {
          this.sendWhatsAppFailedNotification(this.selectedDelivery, this.selectedFailureReason);
        }
      },
      error: () => {
        this.loading = false;
        this.showToast('Erreur enregistrement échec', 'error');
      }
    });
  }

  demarrerLivraison(livraison: Livraison): void {
    const colisId = livraison.colisId;
    if (!colisId) {
      this.showToast('Colis introuvable', 'error');
      return;
    }

    this.loading = true;
    this.apiService.updateColisStatut(colisId, 'EN_LIVRAISON').subscribe({
      next: () => {
        if (this.colisMap[colisId]) {
          this.colisMap[colisId].statut = 'EN_LIVRAISON';
        }
        this.showToast('Livraison démarrée', 'success');
        this.loading = false;
        this.loadLivraisons();
        this.openActiveDelivery(livraison);

        // Envoyer notification WhatsApp au client
        this.sendWhatsAppOnRouteNotification(livraison);
      },
      error: (err) => {
        console.error('Erreur démarrage livraison:', err);
        this.loading = false;
        this.showToast('Erreur lors du démarrage', 'error');
      }
    });
  }

  getPrimaryAction(livraison: Livraison): 'pickup' | 'start' | 'deliver' | 'none' {
    const statut = this.getColisStatut(livraison.colisId);
    if (statut === 'A_ENLEVER') return 'pickup';
    if (statut === 'ENLEVE') return 'start';
    if (statut === 'EN_LIVRAISON') return 'deliver';
    return 'none';
  }

  executePrimaryAction(livraison: Livraison): void {
    const action = this.getPrimaryAction(livraison);
    if (action === 'pickup') this.validerEnlevement(livraison);
    else if (action === 'start') this.demarrerLivraison(livraison);
    else if (action === 'deliver') this.terminerLivraison(livraison);
  }

  getPrimaryActionLabel(livraison: Livraison): string {
    const action = this.getPrimaryAction(livraison);
    const labels: Record<string, string> = {
      pickup: '✅ Valider enlèvement',
      start: '🚚 Démarrer livraison',
      deliver: '✅ Confirmer livraison',
      none: 'Voir détails'
    };
    return labels[action];
  }

  isProgressStepCompleted(stepKey: string, currentStatus: string): boolean {
    const order = ['A_ENLEVER', 'ENLEVE', 'EN_LIVRAISON', 'LIVRE', 'LIVRE_PAYE'];
    const stepIdx = order.indexOf(stepKey);
    const currentIdx = order.indexOf(currentStatus);
    if (currentIdx < 0) return false;
    if (stepKey === 'LIVRE') {
      return ['LIVRE', 'LIVRE_PAYE'].includes(currentStatus);
    }
    return stepIdx >= 0 && currentIdx > stepIdx;
  }

  isProgressStepActive(stepKey: string, currentStatus: string): boolean {
    if (stepKey === 'LIVRE') {
      return ['LIVRE', 'LIVRE_PAYE'].includes(currentStatus);
    }
    return false;
  }

  get filteredTournee(): Livraison[] {
    if (!this.livraisons) return [];
    let filtered = this.livraisons.filter(l => {
      const statut = this.getColisStatut(l.colisId);
      switch (this.tourneeFilter) {
        case 'to_pickup': return statut === 'A_ENLEVER';
        case 'picked_up': return statut === 'ENLEVE';
        case 'in_progress': return statut === 'EN_LIVRAISON';
        case 'completed': return statut === 'LIVRE';
        case 'failed': return statut === 'ECHEC_LIVRAISON' || statut === 'RETOUR_DEPOT';
        default: return true;
      }
    });

    // Recherche rapide
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(l => {
        const ref = this.getLivraisonRefShort(l).toLowerCase();
        const commande = this.getCommandeForLivraison(l);
        const adresse = this.getCommandeFullAddress(commande).toLowerCase();
        const destinataire = this.getCommandeDestinataire(commande).toLowerCase();
        return ref.includes(query) || adresse.includes(query) || destinataire.includes(query);
      });
    }

    // Filtres avancés
    if (this.filterGouvernorat) {
      filtered = filtered.filter(l => {
        const commande = this.getCommandeForLivraison(l);
        const gouvernorat = commande?.adresseArrivee?.gouvernorat || '';
        return gouvernorat.toLowerCase().includes(this.filterGouvernorat.toLowerCase());
      });
    }

    if (this.filterDate) {
      filtered = filtered.filter(l => {
        const commande = this.getCommandeForLivraison(l);
        const date = commande?.dateCreation || '';
        return date.startsWith(this.filterDate);
      });
    }

    if (this.filterMinCOD > 0) {
      filtered = filtered.filter(l => {
        const commande = this.getCommandeForLivraison(l);
        const cod = commande?.montantTotal || 0;
        return cod >= this.filterMinCOD;
      });
    }

    if (this.filterMaxCOD > 0) {
      filtered = filtered.filter(l => {
        const commande = this.getCommandeForLivraison(l);
        const cod = commande?.montantTotal || 0;
        return cod <= this.filterMaxCOD;
      });
    }

    // Tri
    filtered = [...filtered].sort((a, b) => {
      const commandeA = this.getCommandeForLivraison(a);
      const commandeB = this.getCommandeForLivraison(b);

      let comparison = 0;

      switch (this.sortBy) {
        case 'date':
          const dateA = commandeA?.dateCreation || '';
          const dateB = commandeB?.dateCreation || '';
          comparison = dateA.localeCompare(dateB);
          break;
        case 'cod':
          const codA = commandeA?.montantTotal || 0;
          const codB = commandeB?.montantTotal || 0;
          comparison = codA - codB;
          break;
        case 'priority':
          const priorityA = this.getPriorityValue(a);
          const priorityB = this.getPriorityValue(b);
          comparison = priorityA - priorityB;
          break;
        case 'distance':
          // Distance approximation (would need actual coordinates)
          comparison = 0;
          break;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }

  getPriorityValue(livraison: Livraison): number {
    const statut = this.getColisStatut(livraison.colisId);
    const priorityMap: Record<string, number> = {
      'A_ENLEVER': 1,
      'ENLEVE': 2,
      'EN_LIVRAISON': 3,
      'LIVRE': 4,
      'LIVRE_PAYE': 4,
      'ECHEC_LIVRAISON': 5,
      'RETOUR_DEPOT': 5
    };
    return priorityMap[statut] || 99;
  }

  getAvailableGouvernorats(): string[] {
    const gouvernorats = new Set<string>();
    this.livraisons.forEach(l => {
      const commande = this.getCommandeForLivraison(l);
      const gov = commande?.adresseArrivee?.gouvernorat;
      if (gov) gouvernorats.add(gov);
    });
    return Array.from(gouvernorats).sort();
  }

  resetFilters(): void {
    this.filterGouvernorat = '';
    this.filterDate = '';
    this.filterMinCOD = 0;
    this.filterMaxCOD = 0;
    this.searchQuery = '';
  }

  // ========== GAINS ET STATISTIQUES ==========
  calculateEarningsHistory(): void {
    const historyMap = new Map<string, { amount: number; deliveries: number }>();
    const rate = 2; // DT par livraison

    this.livraisons.forEach(l => {
      const commande = this.getCommandeForLivraison(l);
      const statut = this.getColisStatut(l.colisId);
      const date = commande?.dateCreation || new Date().toISOString().split('T')[0];
      const day = date.split('T')[0];

      if (['LIVRE', 'LIVRE_PAYE'].includes(statut)) {
        const current = historyMap.get(day) || { amount: 0, deliveries: 0 };
        current.amount += rate;
        current.deliveries += 1;
        historyMap.set(day, current);
      }
    });

    this.earningsHistory = Array.from(historyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Derniers 7 jours
  }

  getWeeklyEarnings(): number {
    return this.earningsHistory.reduce((sum, day) => sum + day.amount, 0);
  }

  getWeeklyDeliveries(): number {
    return this.earningsHistory.reduce((sum, day) => sum + day.deliveries, 0);
  }

  getAverageDeliveryTime(): string {
    // Simulation - en production, utiliser les timestamps réels
    const completed = this.getCompletedList().length;
    if (completed === 0) return '—';
    const avgMinutes = Math.round(25 + Math.random() * 15); // 25-40 min simulés
    return `${avgMinutes} min`;
  }

  getSuccessRate(): number {
    const total = this.livraisons.length;
    if (total === 0) return 0;
    const completed = this.getCompletedList().length;
    const failed = this.getFailedList().length;
    const successful = completed - failed;
    return Math.round((successful / total) * 100);
  }

  getAverageCOD(): number {
    const completed = this.getCompletedList();
    if (completed.length === 0) return 0;
    const totalCOD = completed.reduce((sum, l) => {
      const commande = this.getCommandeForLivraison(l);
      return sum + (commande?.montantTotal || 0);
    }, 0);
    return Math.round(totalCOD / completed.length);
  }

  // ========== WHATSAPP NOTIFICATIONS ==========
  sendWhatsAppOnRouteNotification(livraison: Livraison): void {
    const commande = this.getCommandeForLivraison(livraison);
    const phone = this.getCommandePhone(commande);
    const clientName = this.getCommandeDestinataire(commande);
    const livraisonRef = this.getLivraisonRefShort(livraison);

    if (!phone || phone === '—') {
      console.log('Pas de numéro de téléphone pour notification WhatsApp');
      return;
    }

    this.apiService.sendWhatsAppOnRoute(phone, clientName, livraisonRef, '15-30 minutes').subscribe({
      next: () => console.log('✅ WhatsApp notification envoyé (en route)'),
      error: (err) => console.error('❌ Erreur WhatsApp notification:', err)
    });
  }

  sendWhatsAppDeliveredNotification(livraison: Livraison): void {
    const commande = this.getCommandeForLivraison(livraison);
    const phone = this.getCommandePhone(commande);
    const clientName = this.getCommandeDestinataire(commande);
    const livraisonRef = this.getLivraisonRefShort(livraison);

    if (!phone || phone === '—') {
      console.log('Pas de numéro de téléphone pour notification WhatsApp');
      return;
    }

    this.apiService.sendWhatsAppDelivered(phone, clientName, livraisonRef).subscribe({
      next: () => console.log('✅ WhatsApp notification envoyé (livré)'),
      error: (err) => console.error('❌ Erreur WhatsApp notification:', err)
    });
  }

  sendWhatsAppFailedNotification(livraison: Livraison, reason: string): void {
    const commande = this.getCommandeForLivraison(livraison);
    const phone = this.getCommandePhone(commande);
    const clientName = this.getCommandeDestinataire(commande);
    const livraisonRef = this.getLivraisonRefShort(livraison);

    if (!phone || phone === '—') {
      console.log('Pas de numéro de téléphone pour notification WhatsApp');
      return;
    }

    this.apiService.sendWhatsAppFailed(phone, clientName, livraisonRef, reason).subscribe({
      next: () => console.log('✅ WhatsApp notification envoyé (échec)'),
      error: (err) => console.error('❌ Erreur WhatsApp notification:', err)
    });
  }

  getActiveDeliveries(): Livraison[] {
    return this.livraisons.filter(l => {
      const s = this.getColisStatut(l.colisId);
      return ['A_ENLEVER', 'ENLEVE', 'EN_LIVRAISON'].includes(s);
    });
  }

  getToPickupList(): Livraison[] {
    return this.livraisons.filter(l => this.getColisStatut(l.colisId) === 'A_ENLEVER');
  }

  getPickedUpList(): Livraison[] {
    return this.livraisons.filter(l => this.getColisStatut(l.colisId) === 'ENLEVE');
  }

  getInProgressList(): Livraison[] {
    return this.livraisons.filter(l => this.getColisStatut(l.colisId) === 'EN_LIVRAISON');
  }

  getCompletedList(): Livraison[] {
    return this.livraisons.filter(l =>
      ['LIVRE', 'LIVRE_PAYE'].includes(this.getColisStatut(l.colisId))
    );
  }

  getFailedList(): Livraison[] {
    return this.livraisons.filter(l =>
      ['ECHEC_LIVRAISON', 'RETOUR_DEPOT', 'RETOUR_EXPEDITEUR'].includes(this.getColisStatut(l.colisId))
    );
  }

  getQueuePreview(): Livraison[] {
    return this.getActiveDeliveries().slice(0, 5);
  }

  getToPickupCount(): number {
    return this.getToPickupList().length;
  }

  getInProgressCount(): number {
    return this.getInProgressList().length;
  }

  // ========== HELPERS COMMANDE ==========
  getCommande(commandeId: string | undefined): Commande | undefined {
    if (!commandeId) return undefined;
    return this.commandesMap[commandeId];
  }

  getCommandeDestinataire(commande?: Commande | null): string {
    if (!commande) return '—';
    return (commande as any).nomDestinataire || commande.clientNom || '—';
  }

  getCommandeDestination(commande?: Commande | null): string {
    if (!commande) return '—';
    return commande.adresseArrivee?.ville || (commande as any).ville || '—';
  }

  getCommandeFullAddress(commande?: Commande | null): string {
    if (!commande?.adresseArrivee) {
      return this.getCommandeDestination(commande);
    }
    const a = commande.adresseArrivee;
    return [a.rue, a.localite, a.ville, a.gouvernorat].filter(Boolean).join(', ');
  }

  getCommandePhone(commande?: Commande | null): string {
    if (!commande) return '—';
    return (commande as any).telephoneDestinataire || commande.telephone || commande.adresseArrivee?.telephone || '—';
  }

  getCommandeTotal(commande?: Commande | null): number {
    return commande?.montantTotal || 0;
  }

  getLivraisonRefShort(livraison: Livraison): string {
    const id = livraison?.id || this.getLinkedCommandeId(livraison) || livraison?.colisId || '';
    if (!id) return 'N/A';
    return '#' + id.substring(Math.max(0, id.length - 6));
  }

  getStatutClass(statut: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'status-pending',
      MANIFESTE: 'status-pending',
      A_ENLEVER: 'status-warning',
      ENLEVE: 'status-info',
      AU_DEPOT: 'status-info',
      EN_LIVRAISON: 'status-in-progress',
      LIVRE: 'status-success',
      LIVRE_PAYE: 'status-success',
      ECHEC_LIVRAISON: 'status-danger',
      RETOUR_DEPOT: 'status-warning',
      RETOUR_EXPEDITEUR: 'status-warning',
      ANNULEE: 'status-muted'
    };
    return map[statut] || 'status-default';
  }

  getStatutLabel(statut: string): string {
    const step = this.trackingSteps.find(s => s.key === statut);
    return step ? step.label : (statut || '—');
  }

  getDeliveryStats(): DeliveryStats {
    return {
      toPickup: this.getToPickupCount(),
      inProgress: this.getInProgressCount() + this.getPickedUpList().length,
      deliveredToday: this.getCompletedList().length,
      failedToday: this.getFailedList().length,
      rating: this.driverInfo?.noteMoyenne || 4.5
    };
  }

  calculateEarnings(): void {
    const delivered = this.getCompletedList().length;
    const rate = 2;
    this.earnings = {
      today: delivered * rate,
      week: delivered * rate * 5,
      month: delivered * rate * 20
    };
  }

  dismissNewAssignments(): void {
    this.newAssignments = [];
  }

  // ========== SUIVI ==========
  searchColis(): void {
    if (!this.searchColisId.trim()) {
      this.searchError = 'Veuillez entrer un ID de colis';
      return;
    }

    this.loading = true;
    this.searchError = '';
    this.foundColis = null;

    this.apiService.getCommandeById(this.searchColisId.trim()).subscribe({
      next: (cmd) => {
        this.foundColis = cmd;
        this.loading = false;
      },
      error: () => {
        const anyApi = this.apiService as any;
        if (typeof anyApi.searchCommandes === 'function') {
          anyApi.searchCommandes(this.searchColisId.trim()).subscribe({
            next: (results: Commande[]) => {
              this.loading = false;
              if (results?.length) this.foundColis = results[0];
              else this.searchError = 'Colis non trouvé';
            },
            error: () => {
              this.loading = false;
              this.searchError = 'Colis non trouvé';
            }
          });
        } else {
          this.loading = false;
          this.searchError = 'Colis non trouvé';
        }
      }
    });
  }

  getColisShortId(colis: any): string {
    return colis?.id ? String(colis.id).substring(0, 8) : 'N/A';
  }

  // ========== VEHICULE / SETTINGS ==========
  loadVehicleInfo(): void {
    // Charger les véhicules depuis le backend (pas de localStorage)
    this.loadAssignedVehicles();
  }

  loadAssignedVehicles(): void {
    if (!this.driverId) return;

    this.apiService.getVehiculeByLivreurId(this.driverId).subscribe({
      next: (vehicle) => {
        this.assignedVehicles = vehicle ? [vehicle] : [];
        // Mettre à jour vehicleInfo depuis le backend
        if (vehicle) {
          this.vehicleInfo = {
            marque: vehicle.marque || '',
            modele: vehicle.modele || '',
            immatriculation: vehicle.immatriculation || '',
            type: vehicle.type || 'Voiture'
          };
        }
      },
      error: () => {
        this.assignedVehicles = [];
        this.vehicleInfo = { marque: '', modele: '', immatriculation: '', type: 'Voiture' };
      }
    });
  }

  private initializeRealtimeSync(): void {
    console.log('ℹ️ Synchronisation temps réel désactivée (utilise les services Spring Boot)');
  }

  uploadDriverPhoto(event: any): void {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.driverPhoto = e.target.result;
      localStorage.setItem('driverPhoto', this.driverPhoto);
      this.showToast('Photo mise à jour', 'success');
    };
    reader.readAsDataURL(file);
  }

  toggleNotifications(): void {
    localStorage.setItem('notificationsEnabled', String(this.notificationsEnabled));
    this.showToast(
      this.notificationsEnabled ? 'Notifications activées' : 'Notifications désactivées',
      'info'
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ========== TOASTS ==========
  showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const id = this.toastIdCounter++;
    this.toasts.push({ id, message, type });
    setTimeout(() => this.removeToast(id), 4000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  // ========== PROFILE HELPERS ==========
  hasDriverPhoto(): boolean {
    return !!this.driverPhoto;
  }

  getDriverNameDisplay(): string {
    return this.driverName || 'Livreur';
  }

  getDriverRating(): string {
    return String(this.driverInfo?.noteMoyenne ?? 4.5);
  }

  getDriverEmail(): string {
    return this.driverInfo?.email || '—';
  }

  getDriverPhone(): string {
    return this.driverInfo?.telephone || '—';
  }

  getDriverGovernorate(): string {
    return this.driverInfo?.gouvernorat || '—';
  }

  isDriverOnline(): boolean {
    return this.driverStatus === 'DISPONIBLE' || this.driverStatus === 'EN_COURSE';
  }

  isDriverOffline(): boolean {
    return this.driverStatus === 'HORS_LIGNE';
  }
}
