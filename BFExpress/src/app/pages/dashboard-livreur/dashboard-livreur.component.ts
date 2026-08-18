import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Livraison, Livreur, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { WebsocketSyncService } from '../../services/websocket-sync.service';

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

type DriverTab =
  | 'dashboard'
  | 'courses'
  | 'map'
  | 'enlevements'
  | 'livraison'
  | 'echecs'
  | 'suivi'
  | 'gains'
  | 'vehicule'
  | 'parametres';

@Component({
  selector: 'app-dashboard-livreur',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard-livreur.component.html',
  styleUrls: ['./dashboard-livreur.component.scss']
})
export class DashboardLivreurComponent implements OnInit, OnDestroy {

  activeTab: DriverTab = 'dashboard';
  user: any = null;

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

  assignedVehicles: any[] = []; // Flottes assignées au livreur

  notificationsEnabled = true;

  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;

  latitude = 36.8065;
  longitude = 10.1815;
  private gpsInterval: any = null;
  private pollInterval: any = null;
  private driverMap: any = null;

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

  courseFilter: 'all' | 'to_pickup' | 'in_progress' | 'completed_today' = 'all';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private websocketSync: WebsocketSyncService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = user;
    this.driverName = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Livreur';
    this.driverId = user.id;

    this.driverPhoto = localStorage.getItem('driverPhoto') || '';
    this.notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
    this.loadVehicleInfo();
    this.loadDriverData();
    this.startPolling();
    this.initializeRealtimeSync();
  }

  ngOnDestroy(): void {
    if (this.gpsInterval) clearInterval(this.gpsInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.driverMap) {
      try { this.driverMap.remove(); } catch {}
      this.driverMap = null;
    }
    this.websocketSync.disconnectAll();
  }

  // ========== NAVIGATION ==========
  setTab(tab: DriverTab): void {
    this.activeTab = tab;
    if (tab === 'map') {
      setTimeout(() => this.initMap(), 150);
    }
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

    this.apiService.getLivraisonsByLivreur(this.driverId).subscribe({
      next: (livraisons) => {
        this.livraisons = livraisons || [];
        this.loadCommandesDetails();
        this.updateCurrentDelivery();
        this.calculateEarnings();
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

    if (colisIds.length > 0) {
      colisIds.forEach(id => {
        // 1. Fetch Colis
        this.apiService.getColisById(id).subscribe({
          next: (colis) => {
            this.colisMap[id] = colis;
            this.updateCurrentDelivery();
            this.calculateEarnings();
          },
          error: (err) => {
            console.error('Error loading colis', id, err);
            this.colisMap[id] = { id: id, statut: 'EN_ATTENTE', poids: 0 };
          }
        });
      });
    }

    // 2. Fetch Commandes pour avoir les vraies destinations et clients
    const commandeIds = this.livraisons
      .map(l => this.getLinkedCommandeId(l))
      .filter((id): id is string => !!id && !this.commandesMap[id]);

    if (commandeIds.length > 0) {
      commandeIds.forEach(id => {
        this.apiService.getCommandeById(id).subscribe({
          next: (cmd) => {
            this.commandesMap[id] = cmd;
          },
          error: (err) => console.error('Error loading commande', id, err)
        });
      });
    }
  }

  private getLinkedCommandeId(livraison: Livraison): string {
    return livraison.colisId || livraison.commandeId || '';
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
          if (this.activeTab === 'map') {
            this.updateMapMarker();
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
  initMap(): void {
    const container = document.getElementById('driver-map');
    if (!container || (window as any).L === undefined) return;

    const L = (window as any).L;

    if (this.driverMap) {
      try { this.driverMap.remove(); } catch {}
      this.driverMap = null;
    }

    this.driverMap = L.map('driver-map').setView([this.latitude, this.longitude], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.driverMap);

    this.addDriverMarker();
    this.addDestinationMarkers();

    setTimeout(() => {
      try { this.driverMap?.invalidateSize(); } catch {}
    }, 200);
  }

  addDriverMarker(): void {
    if (!this.driverMap) return;
    const L = (window as any).L;

    L.marker([this.latitude, this.longitude], {
      icon: L.divIcon({
        className: 'driver-marker',
        html: '<div style="font-size:22px">🚚</div>',
        iconSize: [30, 30]
      })
    })
      .addTo(this.driverMap)
      .bindPopup(`<b>${this.driverName}</b><br>Position actuelle`);
  }

  addDestinationMarkers(): void {
    if (!this.driverMap) return;
    const L = (window as any).L;

    this.getInProgressList().concat(this.getToPickupList()).forEach((livraison, index) => {
      const commande = this.getCommande(this.getLinkedCommandeId(livraison));
      const lat = this.latitude + (index + 1) * 0.01 * (index % 2 === 0 ? 1 : -1);
      const lng = this.longitude + (index + 1) * 0.008;

      L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'destination-marker',
          html: '<div style="font-size:18px">📦</div>',
          iconSize: [28, 28]
        })
      })
        .addTo(this.driverMap)
        .bindPopup(
          `<b>${this.getCommandeDestinataire(commande)}</b><br>${this.getCommandeDestination(commande)}`
        );
    });
  }

  updateMapMarker(): void {
    if (!this.driverMap) return;
    this.driverMap.setView([this.latitude, this.longitude], this.driverMap.getZoom() || 12);
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

    const commande = this.commandesMap[livraison.commandeId || ''];
    const montant = commande?.montantTotal || 0;
    const finalStatus = montant > 0 ? 'LIVRE_PAYE' : 'LIVRE';

    if (!confirm(`Confirmer la livraison en statut ${finalStatus} ?`)) return;

    this.loading = true;

    const finish = () => {
      this.apiService.updateColisStatut(colisId, finalStatus).subscribe({
        next: () => {
          if (this.colisMap[colisId]) {
            this.colisMap[colisId].statut = finalStatus;
          }
          this.showToast('Livraison terminée', 'success');
          this.loading = false;
          this.toggleStatut('DISPONIBLE');
          this.loadLivraisons();
        },
        error: () => {
          this.loading = false;
          this.showToast('Erreur clôture livraison', 'error');
        }
      });
    };

    finish();
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
    this.apiService.updateColisStatut(colisId, 'ECHEC_LIVRAISON').subscribe({
      next: () => {
        if (this.colisMap[colisId]) {
          this.colisMap[colisId].statut = 'ECHEC_LIVRAISON';
        }
        this.showFailureModal = false;
        this.showToast(`Échec enregistré (${this.selectedFailureReason})`, 'success');
        this.loading = false;
        this.toggleStatut('DISPONIBLE');
        this.loadLivraisons();
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
      },
      error: (err) => {
        console.error('Erreur démarrage livraison:', err);
        this.loading = false;
        this.showToast('Erreur lors du démarrage', 'error');
      }
    });
  }

  changeCommandeStatus(livraison: Livraison, newStatus: string): void {
    const commandeId = this.getLinkedCommandeId(livraison);
    if (!commandeId) {
      this.showToast('Commande introuvable (ID manquant)', 'error');
      return;
    }

    console.log('Changement statut:', { commandeId, currentStatus: this.getCommandeStatut(commandeId), newStatus });

    this.loading = true;
    this.apiService.updateCommandeStatut(commandeId, newStatus).subscribe({
      next: () => {
        console.log('Statut changé avec succès:', newStatus);
        if (this.commandesMap[commandeId]) {
          this.commandesMap[commandeId].statut = newStatus;
        }
        this.showToast(`Statut changé: ${this.getStatutLabel(newStatus)}`, 'success');
        this.loading = false;
        this.loadLivraisons();
      },
      error: (err) => {
        console.error('Erreur changement statut:', err);
        this.loading = false;
        const errorMsg = err?.error?.message || err?.message || 'Erreur backend';
        this.showToast(`Erreur: ${errorMsg}`, 'error');
      }
    });
  }

  canChangeToStatus(livraison: Livraison, status: string): boolean {
    const currentStatus = this.getCommandeStatut(this.getLinkedCommandeId(livraison));
    
    // Si même statut, pas de changement
    if (currentStatus === status) return false;
    
    // Autoriser toutes les transitions pour les boutons d'action (les boutons sont déjà conditionnés dans le HTML)
    // La validation stricte n'est pas nécessaire car les boutons ne s'affichent que pour les transitions valides
    return true;
  }

  getStepIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'EN_ATTENTE': '⏳',
      'MANIFESTE': '📋',
      'A_ENLEVER': '📥',
      'ENLEVE': '✅',
      'AU_DEPOT': '🏢',
      'EN_LIVRAISON': '🚚',
      'LIVRE': '📦',
      'LIVRE_PAYE': '💰',
      'ECHEC_LIVRAISON': '❌',
      'RETOUR_DEPOT': '🔄',
      'RETOUR_EXPEDITEUR': '↩️',
      'ANNULEE': '🚫'
    };
    return icons[status] || '📍';
  }

  // Expose getLinkedCommandeId to template
  getLinkedCommandeIdPublic(livraison: Livraison): string {
    return this.getLinkedCommandeId(livraison);
  }

  // ========== LISTES / FILTRES ==========
  get filteredLivraisons(): Livraison[] {
    switch (this.courseFilter) {
      case 'to_pickup':
        return this.getToPickupList();
      case 'in_progress':
        return this.getInProgressList();
      case 'completed_today':
        return this.livraisons.filter(l =>
          ['LIVRE', 'LIVRE_PAYE'].includes(this.getCommandeStatut(this.getLinkedCommandeId(l)))
        );
      default:
        return this.livraisons;
    }
  }

  applyFilter(): void {
    // Triggered by filter change - computed property handles logic
  }

  getToPickupList(): Livraison[] {
    return this.livraisons.filter(l =>
      this.getCommandeStatut(this.getLinkedCommandeId(l)) === 'A_ENLEVER'
    );
  }

  getInProgressList(): Livraison[] {
    return this.livraisons.filter(l =>
      this.getCommandeStatut(this.getLinkedCommandeId(l)) === 'EN_LIVRAISON'
    );
  }

  getFailedList(): Livraison[] {
    return this.livraisons.filter(l =>
      ['ECHEC_LIVRAISON', 'RETOUR_DEPOT', 'RETOUR_EXPEDITEUR'].includes(
        this.getCommandeStatut(this.getLinkedCommandeId(l))
      )
    );
  }

  getQueuePreview(): Livraison[] {
    return this.filteredLivraisons.slice(0, 5);
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

  getCommandeStatut(commandeId: string | undefined): string {
    if (!commandeId) return 'EN_ATTENTE';
    return this.commandesMap[commandeId]?.statut || 'EN_ATTENTE';
  }

  getCommandeDestinataire(commande?: Commande | null): string {
    if (!commande) return '—';
    return (commande as any).nomDestinataire || (commande as any).clientNom || '—';
  }

  getCommandeDestination(commande?: Commande | null): string {
    if (!commande) return '—';
    return commande.adresseArrivee?.ville || (commande as any).ville || '—';
  }

  getCommandePhone(commande?: Commande | null): string {
    if (!commande) return '—';
    return (commande as any).telephoneDestinataire || (commande as any).telephone || '—';
  }

  getCommandeTotal(commande?: Commande | null): number {
    return commande?.montantTotal || 0;
  }

  getLivraisonRefShort(livraison: Livraison): string {
    const id = livraison?.id || this.getLinkedCommandeId(livraison) || '';
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
      inProgress: this.getInProgressCount(),
      deliveredToday: this.livraisons.filter(l =>
        ['LIVRE', 'LIVRE_PAYE'].includes(this.getCommandeStatut(this.getLinkedCommandeId(l)))
      ).length,
      failedToday: this.getFailedList().length,
      rating: this.driverInfo?.noteMoyenne || 4.5
    };
  }

  calculateEarnings(): void {
    const delivered = this.livraisons.filter(l =>
      ['LIVRE', 'LIVRE_PAYE'].includes(this.getCommandeStatut(this.getLinkedCommandeId(l)))
    ).length;

    // Estimation locale — à remplacer par API paiements livreur si dispo
    const rate = 2;
    this.earnings = {
      today: delivered * rate,
      week: delivered * rate * 5,
      month: delivered * rate * 20
    };
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
        // fallback éventuel search
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

  getStepIndex(status: string): number {
    return this.trackingSteps.findIndex(s => s.key === status);
  }

  isStepCompleted(stepKey: string, currentStatus: string): boolean {
    const a = this.getStepIndex(stepKey);
    const b = this.getStepIndex(currentStatus);
    return a >= 0 && b >= 0 && a < b;
  }

  isStepActive(stepKey: string, currentStatus: string): boolean {
    return stepKey === currentStatus;
  }

  getColisShortId(colis: any): string {
    return colis?.id ? String(colis.id).substring(0, 8) : 'N/A';
  }

  // ========== VEHICULE / SETTINGS ==========
  loadVehicleInfo(): void {
    try {
      const stored = localStorage.getItem('driverVehicle');
      this.vehicleInfo = stored
        ? JSON.parse(stored)
        : { marque: '', modele: '', immatriculation: '', type: 'Voiture' };
    } catch {
      this.vehicleInfo = { marque: '', modele: '', immatriculation: '', type: 'Voiture' };
    }
    
    // Charger les véhicules assignés depuis le backend
    this.loadAssignedVehicles();
  }

  loadAssignedVehicles(): void {
    if (!this.driverId) {
      console.log('❌ Pas de driverId disponible');
      return;
    }
    
    console.log('🔍 Chargement des véhicules pour livreur ID:', this.driverId);
    
    // Utiliser l'endpoint spécifique du service Spring Boot
    this.apiService.getVehiculeByLivreurId(this.driverId).subscribe({
      next: (vehicle) => {
        if (vehicle) {
          this.assignedVehicles = [vehicle];
          console.log('✅ Véhicule assigné au livreur:', vehicle);
        } else {
          this.assignedVehicles = [];
          console.log('ℹ️ Aucun véhicule assigné à ce livreur');
        }
      },
      error: (err) => {
        console.error('❌ Erreur chargement véhicule assigné:', err);
        this.assignedVehicles = [];
      }
    });
  }

  // ========== REALTIME SYNC ==========
  private initializeRealtimeSync(): void {
    // Pour l'instant, désactivé car nous utilisons les services Spring Boot existants
    // Vous pouvez réactiver cela si vos services Spring Boot ont des WebSocket
    console.log('ℹ️ Synchronisation temps réel désactivée (utilise les services Spring Boot)');
  }

  saveVehicleInfo(): void {
    localStorage.setItem('driverVehicle', JSON.stringify(this.vehicleInfo));
    this.showToast('Véhicule enregistré', 'success');
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