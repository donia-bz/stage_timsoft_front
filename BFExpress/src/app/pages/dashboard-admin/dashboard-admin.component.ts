import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Commande, Livreur } from '../../services/api.service';
import { AuthService, UserProfile } from '../../services/auth.service';

export interface Depot {
  id: string;
  nom: string;
  ville: string;
  capacite: number;
  colisActuels: number;
}

export interface Vehicule {
  id: string;
  immatriculation: string;
  modele: string;
  capacite: number;
  statut: string;
  dateAjout?: string;
  photoUrl?: string;
  type?: string;
  marque?: string;
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard-admin.component.html',
  styleUrls: ['./dashboard-admin.component.scss']
})
export class DashboardAdminComponent implements OnInit, OnDestroy {

  activeTab:
    | 'stats'
    | 'commandes'
    | 'livreurs'
    | 'carte'
    | 'manifests'
    | 'vehicules'
    | 'depots'
    | 'inscriptions'
    | 'reclamations'
    | 'analytics'
    | 'parametres' = 'stats';

  commandes: Commande[] = [];
  livreurs: Livreur[] = [];
  usersList: UserProfile[] = [];
  depots: Depot[] = [];
  vehicules: Vehicule[] = [];
  manifests: any[] = [];
  reclamations: any[] = [];
  reclamationsAnalysis: { [reclamationId: string]: any } = {};
  anomaliesDetectees: any[] = [];
  suggestedResponses: any[] = [];
  
  reclamationFilters = {
    search: '',
    statut: '',
    type: '',
    priorite: ''
  };
  
  showReclamationDetail = false;
  selectedReclamation: any = null;
  selectedReclamationAnalysis: any = null;
  adminCommentaire = '';
  
  showResponseModal = false;
  activeResponseTab: 'FORMELLE' | 'EMPATHIQUE' | 'TECHNIQUE' = 'EMPATHIQUE';
  responseText = '';

  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;

  deliveriesHistory: any[] = [];
  showHistoryPanel = false;
  historyForOrderId: string | null = null;

  stats: any = {
    avgDeliveryMin: 0,
    avgDelayMin: 0,
    commandesCount: 0,
    revenus: 0,
    driverPerformance: {},
    successRate: 0,
    satisfactionRate: 0,
    satisfactionScore: 0
  };

  showUserPanel = false;
  selectedUser: UserProfile | null = null;

  selectedDrivers: { [key: string]: string } = {};
  aiPredictions: { [key: string]: { driverName: string; score: number } } = {};
  assignmentPanelOrderId: string | null = null;

  searchFilter = '';
  private adminMap: any = null;

  gouvernorats: string[] = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
    'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir',
    'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès',
    'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
  ];

  nouveauLivreur: any = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    gouvernorat: '',
    typePermis: 'B',
    statut: 'INSCRIPTION',
    photoUrl: ''
  };

  nouveauVehicule: any = {
    immatriculation: '',
    modele: '',
    marque: '',
    type: 'Voiture',
    capacite: 10,
    statut: 'DISPONIBLE',
    photoUrl: ''
  };

  nouveauDepot: any = {
    nom: '',
    ville: '',
    capacite: 100
  };

  modeEditionLivreur = false;
  livreurEnEdition: string | null = null;

  private refreshInterval: any = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.refreshData();
    this.startRealTimeUpdates();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private startRealTimeUpdates(): void {
    // Refresh data every 10 seconds for real-time monitoring
    this.refreshInterval = setInterval(() => {
      this.refreshData();
    }, 10000);
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

  // ========== DATA ==========
  refreshData(): void {
    this.apiService.getAllCommandes().subscribe({
      next: (res) => {
        this.commandes = res || [];
        this.updateDepotOccupancy();
        this.computeStats();
      },
      error: (err) => console.error('Error fetching orders:', err)
    });

    this.authService.getAllUsers().subscribe({
      next: (res) => {
        this.usersList = res || [];
        this.mergePendingLivreurUsers();
      },
      error: (err) => console.error('Error fetching users:', err)
    });

    this.apiService.getAllLivreurs().subscribe({
      next: (res) => {
        this.livreurs = res || [];
        this.mergePendingLivreurUsers();
        this.updateDepotOccupancy();
        this.computeStats();
      },
      error: (err) => {
        console.error('Error fetching drivers:', err);
        this.mergePendingLivreurUsers();
      }
    });

    this.chargerManifests();

    // Charger les réclamations
    this.apiService.getAllReclamations().subscribe({
      next: (res) => {
        this.reclamations = res || [];
      },
      error: (err) => console.error('Error fetching reclamations:', err)
    });

    try {
      const d = localStorage.getItem('bf_depots');
      const v = localStorage.getItem('bf_vehicules');
      this.depots = d ? JSON.parse(d) : [];
      this.vehicules = v ? JSON.parse(v) : [];
      this.updateDepotOccupancy();
    } catch {
      this.depots = [];
      this.vehicules = [];
    }
  }

  mergePendingLivreurUsers(): void {
    const pendingUsers = this.usersList.filter(u =>
      u.role === 'LIVREUR' && (u.statut === 'INSCRIPTION' || u.approuve === false)
    );

    pendingUsers.forEach(u => {
      const exists = this.livreurs.some(l => l.email === u.email || l.id === u.id);
      if (!exists) {
        this.livreurs.push({
          id: u.id,
          nom: u.nom,
          prenom: u.prenom,
          email: u.email,
          telephone: u.telephone,
          gouvernorat: (u as any).gouvernorat || '',
          statut: 'INSCRIPTION',
          noteMoyenne: 5.0,
          nombreLivraisons: 0,
          dateInscription: new Date().toISOString()
        } as Livreur);
      }
    });
  }

  get filteredCommandes(): Commande[] {
    if (!this.searchFilter.trim()) return this.commandes;
    const q = this.searchFilter.toLowerCase();
    return this.commandes.filter(c =>
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.statut && c.statut.toLowerCase().includes(q)) ||
      (c.typeService && c.typeService.toLowerCase().includes(q)) ||
      ((c as any).nomDestinataire && String((c as any).nomDestinataire).toLowerCase().includes(q))
    );
  }

  // ========== MAP ==========
  openCarteTab(): void {
    this.activeTab = 'carte';
    this.initMapAdmin();
  }

  initMapAdmin(): void {
    setTimeout(() => {
      const container = document.getElementById('admin-map');
      if (!container || (window as any).L === undefined) return;

      if (this.adminMap) {
        this.adminMap.remove();
        this.adminMap = null;
      }

      const L = (window as any).L;
      this.adminMap = L.map('admin-map').setView([36.8065, 10.1815], 9);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.adminMap);

      this.livreurs.forEach(l => {
        const lat = l.latitudeActuelle || 36.8065 + (Math.random() - 0.5) * 0.2;
        const lon = l.longitudeActuelle || 10.1815 + (Math.random() - 0.5) * 0.2;
        const popupText = `<b>${l.nom} ${l.prenom}</b><br>Statut: ${l.statut || 'DISPONIBLE'}<br>Gouvernorat: ${l.gouvernorat || 'Tunis'}`;
        L.marker([lat, lon]).addTo(this.adminMap).bindPopup(popupText);
      });
    }, 200);
  }

  // ========== DEPOTS ==========
  updateDepotOccupancy(): void {
    this.depots.forEach(depot => {
      const ville = (depot.ville || '').toLowerCase();
      depot.colisActuels = this.commandes.filter(c => {
        const departVille = (c.adresseDepart?.ville || '').toLowerCase();
        const statut = c.statut || '';
        return departVille === ville && !['LIVRE', 'LIVRE_PAYE', 'ANNULEE'].includes(statut);
      }).length;
    });
    localStorage.setItem('bf_depots', JSON.stringify(this.depots));
  }

  getDepotFillPercent(depot: any): number {
    if (!depot.capacite) return 0;
    return Math.min(100, Math.round(((depot.colisActuels || 0) / depot.capacite) * 100));
  }

  isDepotOverCapacity(depot: any): boolean {
    return (depot.colisActuels || 0) >= depot.capacite;
  }

  addDepot(nom: string, ville: string, capacite: number): void {
    const depot: Depot = {
      id: 'DEP' + Date.now(),
      nom,
      ville,
      capacite,
      colisActuels: 0
    };
    this.depots.push(depot);
    this.updateDepotOccupancy();
    this.showToast('Dépôt ajouté', 'success');
  }

  addDepotAndReset(): void {
    if (!this.nouveauDepot.nom || !this.nouveauDepot.ville) {
      this.showToast('Nom et ville obligatoires', 'error');
      return;
    }
    this.addDepot(this.nouveauDepot.nom, this.nouveauDepot.ville, this.nouveauDepot.capacite || 100);
    this.nouveauDepot = { nom: '', ville: '', capacite: 100 };
  }

  removeDepot(id: string): void {
    this.depots = this.depots.filter(d => d.id !== id);
    localStorage.setItem('bf_depots', JSON.stringify(this.depots));
    this.showToast('Dépôt supprimé', 'success');
  }

  // ========== USERS ==========
  getPendingApprovals(): UserProfile[] {
    return this.usersList.filter(u => u.statut === 'INSCRIPTION' || u.approuve === false);
  }

  getPendingUsersCount(): number {
    return this.getPendingApprovals().length;
  }

  approveUser(userId: string): void {
    this.authService.approuverUtilisateur(userId).subscribe({
      next: () => {
        this.showToast('Utilisateur approuvé', 'success');
        this.refreshData();
      },
      error: () => {
        const user = this.usersList.find(u => u.id === userId);
        if (user) {
          user.approuve = true;
          user.statut = 'ACTIF';
        }
        this.showToast('Utilisateur approuvé (mode local)', 'info');
      }
    });
  }

  deleteUser(user: UserProfile): void {
    if (!confirm(`Supprimer définitivement ${user.prenom} ${user.nom} ?`)) return;

    this.authService.supprimerUtilisateur(user.id).subscribe({
      next: () => {
        this.showToast('Utilisateur supprimé', 'success');
        this.refreshData();
      },
      error: () => {
        this.usersList = this.usersList.filter(u => u.id !== user.id);
        this.showToast('Utilisateur supprimé (mode local)', 'info');
      }
    });
  }

  viewUserDetails(user: UserProfile): void {
    this.selectedUser = user;
    this.showUserPanel = true;
    alert(
      `Utilisateur\n\nNom: ${user.prenom} ${user.nom}\nEmail: ${user.email}\nTéléphone: ${user.telephone || '—'}\nRôle: ${user.role}`
    );
  }

  closeUserPanel(): void {
    this.showUserPanel = false;
    this.selectedUser = null;
  }

  getUserRole(user: UserProfile): string {
    return user.role || 'CLIENT';
  }

  // ========== COMMANDES / DISPATCH ==========
  isOrderPending(order: Commande): boolean {
    return ['EN_ATTENTE', 'MANIFESTE', 'A_ENLEVER'].includes(order.statut || 'EN_ATTENTE');
  }

  assignDriverManually(order: Commande): void {
    const driverId = this.selectedDrivers[order.id || ''];
    if (!driverId) {
      this.showToast('Veuillez sélectionner un livreur', 'error');
      return;
    }

    const orderId = order.id || '';
    this.apiService.creerLivraison(orderId, driverId).subscribe({
      next: () => {
        this.apiService.updateCommandeStatut(orderId, 'EN_LIVRAISON').subscribe({
          next: () => {
            this.apiService.updateLivreurStatut(driverId, 'EN_COURSE').subscribe({
              next: () => {
                this.showToast('Livreur affecté avec succès', 'success');
                this.refreshData();
              },
              error: () => {
                this.showToast('Affectation OK (statut livreur local)', 'info');
                this.refreshData();
              }
            });
          },
          error: () => {
            this.showToast('Livraison créée, statut commande non mis à jour', 'info');
            this.refreshData();
          }
        });
      },
      error: (err) => this.showToast('Erreur d’affectation : ' + (err.message || ''), 'error')
    });
  }

  assignDriverAI(order: Commande): void {
    const orderId = order.id || '';
    if (!orderId) return;

    const availableDrivers = this.livreurs.filter(l => l.statut === 'DISPONIBLE');
    if (availableDrivers.length === 0) {
      this.showToast('Aucun livreur disponible', 'info');
      return;
    }

    const lat = 36.8;
    const lon = 10.1;

    this.apiService.affecterLivreur(orderId, lat, lon, availableDrivers).subscribe({
      next: (aiRes) => {
        const bestDriver = this.livreurs.find(l => l.id === aiRes.livreurId);
        if (!bestDriver) {
          this.showToast('Livreur recommandé introuvable', 'error');
          return;
        }

        this.aiPredictions[orderId] = {
          driverName: `${bestDriver.nom} ${bestDriver.prenom}`,
          score: aiRes.score
        };

        if (
          confirm(
            `L’IA recommande ${bestDriver.nom} ${bestDriver.prenom} (score ${Math.round(
              (aiRes.score || 0) * 100
            )}%). Confirmer ?`
          )
        ) {
          this.selectedDrivers[orderId] = bestDriver.id;
          this.assignDriverManually(order);
        }
      },
      error: (err) => this.showToast('Erreur IA : ' + (err.message || ''), 'error')
    });
  }

  openHistory(order: Commande): void {
    const orderId = order.id || '';
    this.historyForOrderId = orderId;
    this.showHistoryPanel = true;
    this.deliveriesHistory = [];

    this.apiService.getAllLivraisons().subscribe({
      next: (livs) => {
        const related = (livs || []).filter(
          (l: any) => l.commandeId === orderId || l.colisId === orderId
        );

        const promises = related.map(
          (l: any) =>
            new Promise(resolve => {
              this.apiService.getPositions(l.id).subscribe({
                next: positions => resolve({ livraison: l, positions }),
                error: () => resolve({ livraison: l, positions: [] })
              });
            })
        );

        Promise.all(promises).then((res: any) => {
          this.deliveriesHistory = res;
        });
      },
      error: err => console.error('Erreur historique:', err)
    });
  }

  closeHistory(): void {
    this.showHistoryPanel = false;
    this.historyForOrderId = null;
    this.deliveriesHistory = [];
  }

  // ========== LIVREURS ==========
  enregistrerLivreur(): void {
    if (!this.nouveauLivreur.nom || !this.nouveauLivreur.prenom || !this.nouveauLivreur.gouvernorat) {
      this.showToast('Nom, prénom et gouvernorat obligatoires', 'error');
      return;
    }

    const payload: any = {
      id: 'LIV-' + Date.now(),
      nom: this.nouveauLivreur.nom,
      prenom: this.nouveauLivreur.prenom,
      email: this.nouveauLivreur.email,
      telephone: this.nouveauLivreur.telephone,
      gouvernorat: this.nouveauLivreur.gouvernorat,
      typePermis: this.nouveauLivreur.typePermis || 'B',
      statut: 'DISPONIBLE',
      dateInscription: new Date().toISOString(),
      noteMoyenne: 5,
      nombreLivraisons: 0
    };

    this.apiService.creerLivreur(payload).subscribe({
      next: (livreur) => {
        this.livreurs.push(livreur);
        this.resetLivreurForm();
        this.showToast('Livreur enregistré', 'success');
        this.refreshData();
      },
      error: () => {
        this.livreurs.push(payload);
        this.resetLivreurForm();
        this.showToast('Livreur enregistré (mode local)', 'info');
      }
    });
  }

  resetLivreurForm(): void {
    this.nouveauLivreur = {
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      gouvernorat: '',
      typePermis: 'B',
      statut: 'INSCRIPTION',
      photoUrl: ''
    };
  }

  validerLivreur(livreurId: string): void {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (!livreur) return;

    livreur.statut = 'DISPONIBLE';
    this.apiService.updateLivreurStatut(livreurId, 'DISPONIBLE').subscribe({
      next: () => {
        this.showToast(`Livreur ${livreur.prenom} ${livreur.nom} validé`, 'success');
        this.refreshData();
      },
      error: () => {
        this.showToast('Livreur validé (mode local)', 'info');
      }
    });
  }

  affecterGouvernoratEtValider(livreur: Livreur): void {
    if (!livreur.gouvernorat) {
      this.showToast('Choisissez un gouvernorat', 'error');
      return;
    }

    this.apiService.updateLivreur(livreur.id, { gouvernorat: livreur.gouvernorat }).subscribe({
      next: () => this.validerLivreur(livreur.id),
      error: () => this.validerLivreur(livreur.id)
    });
  }

  affecterGouvernorat(livreurId: string, gouvernorat: string): void {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (!livreur) return;

    livreur.gouvernorat = gouvernorat;
    this.apiService.updateLivreur(livreurId, { gouvernorat }).subscribe({
      next: () => this.showToast(`Affecté à ${gouvernorat}`, 'success'),
      error: () => this.showToast('Affectation locale enregistrée', 'info')
    });
  }

  suspendreLivreur(livreurId: string): void {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (!livreur) return;

    livreur.statut = 'SUSPENDU';
    this.apiService.updateLivreurStatut(livreurId, 'SUSPENDU').subscribe({
      next: () => {
        this.showToast('Livreur suspendu', 'success');
        this.refreshData();
      },
      error: () => this.showToast('Livreur suspendu (mode local)', 'info')
    });
  }

  reactiverLivreur(livreurId: string): void {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (!livreur) return;

    livreur.statut = 'DISPONIBLE';
    this.apiService.updateLivreurStatut(livreurId, 'DISPONIBLE').subscribe({
      next: () => {
        this.showToast('Livreur réactivé', 'success');
        this.refreshData();
      },
      error: () => this.showToast('Livreur réactivé (mode local)', 'info')
    });
  }

  toggleDriverStatus(driver: Livreur): void {
    const newStatus = driver.statut === 'DISPONIBLE' ? 'HORS_LIGNE' : 'DISPONIBLE';
    this.apiService.updateLivreurStatut(driver.id, newStatus).subscribe({
      next: (res) => {
        driver.statut = res.statut || newStatus;
        this.showToast(`Statut : ${newStatus}`, 'success');
      },
      error: () => {
        driver.statut = newStatus;
        this.showToast(`Statut local : ${newStatus}`, 'info');
      }
    });
  }

  supprimerLivreur(lId: string): void {
    const l = this.livreurs.find(liv => liv.id === lId);
    if (!l) return;
    if (!confirm(`Supprimer le livreur ${l.prenom} ${l.nom} ?`)) return;

    this.apiService.deleteLivreur(lId).subscribe({
      next: () => {
        this.showToast('Livreur supprimé', 'success');
        this.refreshData();
      },
      error: () => {
        this.livreurs = this.livreurs.filter(liv => liv.id !== lId);
        this.showToast('Livreur supprimé (mode local)', 'info');
      }
    });
  }

  voirDetailsLivreur(l: Livreur): void {
    alert(
      `Livreur\n\nNom: ${l.prenom} ${l.nom}\nEmail: ${l.email || '—'}\nTéléphone: ${
        l.telephone || '—'
      }\nGouvernorat: ${l.gouvernorat || '—'}\nStatut: ${l.statut || '—'}`
    );
  }

  getPendingRegistrations(): Livreur[] {
    return this.livreurs.filter(l => l.statut === 'INSCRIPTION');
  }

  getAvailableDrivers(): Livreur[] {
    return this.livreurs.filter(l => l.statut === 'DISPONIBLE');
  }

  getActiveDriversCount(): number {
    return this.livreurs.filter(l => l.statut === 'DISPONIBLE' || l.statut === 'EN_COURSE').length;
  }

  getAvailableDriversCount(): number {
    return this.livreurs.filter(l => l.statut === 'DISPONIBLE').length;
  }

  getLivreurGouvernorat(livreur: Livreur): string {
    return livreur.gouvernorat || 'Non assigné';
  }

  getLivreurNote(livreur: Livreur): string {
    return String(livreur.noteMoyenne ?? 4.8);
  }

  getDriverFullName(driver: Livreur): string {
    return `${driver.prenom || ''} ${driver.nom || ''}`.trim();
  }

  getDriverFirstInitial(driver: Livreur): string {
    return driver.prenom ? driver.prenom.charAt(0) : (driver.nom ? driver.nom.charAt(0) : 'L');
  }

  getDriverGouvernorat(driver: Livreur): string {
    return driver.gouvernorat || 'Non assigné';
  }

  getDriverStatus(driver: Livreur): string {
    return driver.statut || 'INCONNU';
  }

  isDriverAvailable(driver: Livreur): boolean {
    return driver.statut === 'DISPONIBLE';
  }

  isDriverSuspended(driver: Livreur): boolean {
    return driver.statut === 'SUSPENDU';
  }

  getAllLivreurs(): Livreur[] {
    return this.livreurs;
  }

  // ========== VEHICULES ==========
  addVehicule(immatriculation: string, modele: string, capacite: number): void {
    const v: Vehicule = {
      id: 'VEH' + Date.now(),
      immatriculation,
      modele,
      capacite,
      statut: 'DISPONIBLE',
      dateAjout: new Date().toISOString(),
      photoUrl: this.nouveauVehicule.photoUrl || '',
      type: this.nouveauVehicule.type || 'Voiture',
      marque: this.nouveauVehicule.marque || ''
    };
    this.vehicules.push(v);
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
    this.showToast('Véhicule ajouté', 'success');
  }

  addVehiculeAndReset(): void {
    if (!this.nouveauVehicule.immatriculation || !this.nouveauVehicule.modele) {
      this.showToast('Immatriculation et modèle obligatoires', 'error');
      return;
    }
    this.addVehicule(
      this.nouveauVehicule.immatriculation,
      this.nouveauVehicule.modele,
      this.nouveauVehicule.capacite || 10
    );
    this.nouveauVehicule = {
      immatriculation: '',
      modele: '',
      marque: '',
      type: 'Voiture',
      capacite: 10,
      statut: 'DISPONIBLE',
      photoUrl: ''
    };
  }

  removeVehicule(id: string): void {
    this.vehicules = this.vehicules.filter(v => v.id !== id);
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
    this.showToast('Véhicule supprimé', 'success');
  }

  updateVehicleCapacity(vehicleId: string, newCapacity: number): void {
    const vehicle = this.vehicules.find(v => v.id === vehicleId);
    if (!vehicle) return;
    vehicle.capacite = newCapacity;
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
    this.showToast('Capacité mise à jour', 'success');
  }

  updateVehicleStatus(vehicleId: string, newStatus: string): void {
    const vehicle = this.vehicules.find(v => v.id === vehicleId);
    if (!vehicle) return;
    vehicle.statut = newStatus;
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
    this.showToast('État mis à jour', 'success');
  }

  getVehicleTypeDisplay(vehicle: Vehicule): string {
    return vehicle.type || 'Voiture';
  }

  getAllVehicles(): Vehicule[] {
    return this.vehicules;
  }

  getDriverForVehicle(vehicleId: string): Livreur | undefined {
    return this.livreurs.find(l => (l as any).vehiculeId === vehicleId);
  }

  // ========== MANIFESTS ==========
  chargerManifests(): void {
    this.apiService.getAllManifestes().subscribe({
      next: (manifests) => {
        this.manifests = (manifests || []).filter(
          (m: any) =>
            m.statut === 'IMPRIME' ||
            m.statut === 'VALIDE' ||
            m.statut === 'A_ENLEVER' ||
            m.statut === 'EN_LIVRAISON' ||
            m.statut === 'VALIDE'
        );
      },
      error: () => {
        this.manifests = [];
      }
    });
  }

  getPendingManifests(): any[] {
    return this.manifests.filter(
      m => m.statut === 'IMPRIME' || m.statut === 'VALIDE' || m.statut === 'BROUILLON'
    );
  }

  getInProgressManifests(): any[] {
    return this.manifests.filter(
      m => m.statut === 'A_ENLEVER' || m.statut === 'EN_LIVRAISON'
    );
  }

  hasNoManifests(): boolean {
    return this.manifests.length === 0;
  }

  getSelectedDriverForManifest(manifestId: string): string {
    return this.selectedDrivers[manifestId || ''] || '';
  }

  isManifestDriverSelected(manifestId: string): boolean {
    return !!this.selectedDrivers[manifestId || ''];
  }

  affecterManifest(manifestId: string, livreurId: string): void {
    if (!livreurId) {
      this.showToast('Sélectionnez un livreur', 'error');
      return;
    }

    const manifest = this.manifests.find(m => m.id === manifestId);
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (!manifest || !livreur) return;

    manifest.livreurId = livreurId;
    manifest.statut = 'A_ENLEVER';

    this.apiService.updateManifeste(manifestId, manifest).subscribe({
      next: () => {
        this.showToast(`Manifeste affecté à ${livreur.prenom} ${livreur.nom}`, 'success');
        this.refreshData();
      },
      error: () => {
        this.showToast('Affectation enregistrée localement', 'info');
      }
    });
  }

  validerRetraitManifest(manifestId: string): void {
    const manifest = this.manifests.find(m => m.id === manifestId);
    if (!manifest) return;

    manifest.statut = 'EN_LIVRAISON';
    this.apiService.updateManifeste(manifestId, manifest).subscribe({
      next: () => {
        this.showToast('Retrait validé — en livraison', 'success');
        this.refreshData();
      },
      error: () => this.showToast('Validation locale', 'info')
    });
  }

  canValidateRetrait(manifest: any): boolean {
    return this.getManifestStatus(manifest) === 'A_ENLEVER';
  }

  getManifestId(manifest: any): string {
    return manifest?.id || 'N/A';
  }

  getManifestStatus(manifest: any): string {
    return manifest?.statut || 'INCONNU';
  }

  getManifestClient(manifest: any): string {
    return manifest?.clientId || 'N/A';
  }

  getManifestColisCount(manifest: any): number {
    return manifest?.nombreColis || manifest?.commandeIds?.length || 0;
  }

  getManifestDate(manifest: any): string {
    return this.formatDate(manifest?.dateCreation || '');
  }

  getDriverNameForManifest(livreurId: string): string {
    const driver = this.livreurs.find(l => l.id === livreurId);
    return driver ? `${driver.prenom} ${driver.nom}` : 'Non assigné';
  }

  // ========== STATS ==========
  computeStats(): void {
    const commandes = this.commandes || [];
    this.stats.commandesCount = commandes.length;
    this.stats.revenus = this.getTotalRevenue();

    const livree =
      this.getOrderCountByStatus('LIVRE') + this.getOrderCountByStatus('LIVRE_PAYE');
    const totalFinished =
      livree +
      this.getOrderCountByStatus('RETOUR_DEPOT') +
      this.getOrderCountByStatus('RETOUR_EXPEDITEUR') +
      this.getOrderCountByStatus('ANNULEE');

    this.stats.successRate =
      totalFinished > 0 ? Math.round((livree / totalFinished) * 1000) / 10 : 0;

    const notes = this.livreurs
      .filter(l => l.noteMoyenne && l.noteMoyenne > 0)
      .map(l => l.noteMoyenne!);
    this.stats.satisfactionScore = notes.length
      ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
      : 0;
    this.stats.satisfactionRate = Math.round((this.stats.satisfactionScore / 5) * 1000) / 10;

    this.apiService.getAllLivraisons().subscribe({
      next: (livs) => {
        const finished = (livs || []).filter((l: any) => l.dateDebut && l.dateFin);
        const durations = finished.map(
          (l: any) =>
            (new Date(l.dateFin).getTime() - new Date(l.dateDebut).getTime()) / 60000
        );
        this.stats.avgDeliveryMin = durations.length
          ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
          : 0;

        const byDriver: any = {};
        (livs || []).forEach((l: any) => {
          const d = l.livreurId || 'unknown';
          if (!byDriver[d]) byDriver[d] = { count: 0, totalMin: 0 };
          if (l.dateDebut && l.dateFin) {
            const mins =
              (new Date(l.dateFin).getTime() - new Date(l.dateDebut).getTime()) / 60000;
            byDriver[d].count += 1;
            byDriver[d].totalMin += mins;
          }
        });
        Object.keys(byDriver).forEach(k => {
          byDriver[k].avgMin = byDriver[k].count
            ? byDriver[k].totalMin / byDriver[k].count
            : 0;
        });
        this.stats.driverPerformance = byDriver;
      },
      error: () => {}
    });
  }

  getOrderCountByStatus(status: string): number {
    return this.commandes.filter(c => c.statut === status).length;
  }

  getOrderPercentage(status: string): number {
    const total = this.commandes.length;
    if (total === 0) return 0;
    return (this.getOrderCountByStatus(status) / total) * 100;
  }

  getTotalRevenue(): number {
    return this.commandes.reduce((sum, cmd) => sum + (cmd.montantTotal || 0), 0);
  }

  getSuccessRate(): number {
    const total = this.commandes.length;
    if (total === 0) return 0;
    const delivered =
      this.getOrderCountByStatus('LIVRE') + this.getOrderCountByStatus('LIVRE_PAYE');
    return Math.round((delivered / total) * 100);
  }

  getReturnRate(): number {
    const total = this.commandes.length;
    if (total === 0) return 0;
    const returned =
      this.getOrderCountByStatus('RETOUR_DEPOT') +
      this.getOrderCountByStatus('RETOUR_EXPEDITEUR') +
      this.getOrderCountByStatus('ECHEC_LIVRAISON');
    return Math.round((returned / total) * 100);
  }

  getStatsAvgDelivery(): number {
    return this.stats.avgDeliveryMin || 0;
  }

  getStatsSuccessRate(): number {
    return this.stats.successRate || this.getSuccessRate();
  }

  getStatsSatisfaction(): number {
    return this.stats.satisfactionScore || 0;
  }

  // ========== RECLAMATIONS ==========
  updateReclamationStatus(reclamationId: string, newStatut: string): void {
    this.apiService.updateReclamationStatut(reclamationId, newStatut).subscribe({
      next: () => {
        this.showToast('Statut de la réclamation mis à jour', 'success');
        this.refreshData();
      },
      error: (err) => {
        console.error('Error updating reclamation status:', err);
        this.showToast('Erreur lors de la mise à jour', 'error');
      }
    });
  }

  deleteReclamation(reclamationId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette réclamation ?')) {
      this.apiService.deleteReclamation(reclamationId).subscribe({
        next: () => {
          this.showToast('Réclamation supprimée', 'success');
          this.refreshData();
        },
        error: (err) => {
          console.error('Error deleting reclamation:', err);
          this.showToast('Erreur lors de la suppression', 'error');
        }
      });
    }
  }

  getReclamationStatutClass(statut: string): string {
    switch (statut) {
      case 'EN_ATTENTE': return 'status-pending';
      case 'EN_COURS': return 'status-in-progress';
      case 'RESOLUE': return 'status-resolved';
      case 'REJETEE': return 'status-rejected';
      default: return 'status-default';
    }
  }

  getReclamationClientName(clientId: string): string {
    const client = this.usersList.find(u => u.id === clientId);
    return client ? `${client.prenom} ${client.nom}` : 'Client inconnu';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ========== RECLAMATIONS AMÉLIORÉES ==========
  
  get filteredReclamations(): any[] {
    let filtered = this.reclamations;
    
    if (this.reclamationFilters.search) {
      const search = this.reclamationFilters.search.toLowerCase();
      filtered = filtered.filter(rec => 
        (rec.id && rec.id.toLowerCase().includes(search)) ||
        (rec.description && rec.description.toLowerCase().includes(search)) ||
        (rec.type && rec.type.toLowerCase().includes(search)) ||
        (rec.objet && rec.objet.toLowerCase().includes(search))
      );
    }
    
    if (this.reclamationFilters.statut) {
      filtered = filtered.filter(rec => rec.statut === this.reclamationFilters.statut);
    }
    
    if (this.reclamationFilters.type) {
      filtered = filtered.filter(rec => 
        rec.type === this.reclamationFilters.type || rec.objet === this.reclamationFilters.type
      );
    }
    
    if (this.reclamationFilters.priorite) {
      filtered = filtered.filter(rec => 
        this.getReclamationPriority(rec) === this.reclamationFilters.priorite
      );
    }
    
    // Trier par priorité et date
    return filtered.sort((a, b) => {
      const priorityOrder = { 'URGENT': 0, 'NORMAL': 1, 'FAIBLE': 2 };
      const priorityA = priorityOrder[this.getReclamationPriority(a)] || 99;
      const priorityB = priorityOrder[this.getReclamationPriority(b)] || 99;
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      const dateA = new Date(a.dateCreation || 0).getTime();
      const dateB = new Date(b.dateCreation || 0).getTime();
      return dateB - dateA;
    });
  }

  getReclamationsByStatut(statut: string): any[] {
    return this.reclamations.filter(rec => rec.statut === statut);
  }

  getReclamationTypes(): string[] {
    const types = new Set<string>();
    this.reclamations.forEach(rec => {
      if (rec.type) types.add(rec.type);
      if (rec.objet) types.add(rec.objet);
    });
    return Array.from(types);
  }

  getReclamationPriority(reclamation: any): string {
    // Si analyse IA existe, utiliser la priorité IA
    if (this.reclamationsAnalysis[reclamation.id]) {
      return this.reclamationsAnalysis[reclamation.id].priorite || 'NORMAL';
    }
    
    // Sinon, déterminer priorité basée sur règles
    const statut = reclamation.statut || 'EN_ATTENTE';
    const type = (reclamation.type || reclamation.objet || '').toLowerCase();
    const daysSinceCreation = this.getDaysSince(reclamation.dateCreation);
    
    // Règles de priorité
    if (type.includes('perdu') || type.includes('endommagé') || type.includes('paiement')) {
      return 'URGENT';
    }
    
    if (daysSinceCreation > 3 && statut === 'EN_ATTENTE') {
      return 'URGENT';
    }
    
    if (daysSinceCreation > 1 && statut === 'EN_ATTENTE') {
      return 'NORMAL';
    }
    
    return 'FAIBLE';
  }

  getReclamationPriorityClass(reclamation: any): string {
    const priority = this.getReclamationPriority(reclamation);
    switch (priority) {
      case 'URGENT': return 'priority-urgent';
      case 'NORMAL': return 'priority-normal';
      case 'FAIBLE': return 'priority-faible';
      default: return 'priority-default';
    }
  }

  getReclamationPriorityLabel(reclamation: any): string {
    const priority = this.getReclamationPriority(reclamation);
    const labels = { 'URGENT': '🔴', 'NORMAL': '🟡', 'FAIBLE': '🟢' };
    return labels[priority] || '⚪';
  }

  isReclamationUrgente(reclamation: any): boolean {
    return this.getReclamationPriority(reclamation) === 'URGENT';
  }

  getTauxResolution(): number {
    if (this.reclamations.length === 0) return 0;
    const resolues = this.reclamations.filter(rec => rec.statut === 'RESOLUE').length;
    return Math.round((resolues / this.reclamations.length) * 100);
  }

  getClientReclamationCount(clientId: string): number {
    return this.reclamations.filter(rec => rec.clientId === clientId).length;
  }

  getDaysSince(dateString?: string): number {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  resetReclamationFilters(): void {
    this.reclamationFilters = {
      search: '',
      statut: '',
      type: '',
      priorite: ''
    };
  }

  // ========== ANALYSE IA RECLAMATIONS ==========
  
  analyserReclamationsIA(): void {
    this.showToast('Analyse IA en cours...', 'info');
    
    // Appel réel API pour détecter les anomalies
    this.apiService.detecterAnomaliesReclamations(this.reclamations, 7).subscribe({
      next: (response) => {
        this.anomaliesDetectees = response.anomalies || [];
        this.classifierReclamations();
        this.showToast('Analyse IA terminée', 'success');
      },
      error: (err) => {
        console.error('Erreur IA anomalies:', err);
        // Fallback vers détection locale
        this.detecterAnomalies();
        this.classifierReclamations();
        this.showToast('Analyse IA locale (erreur API)', 'info');
      }
    });
  }

  detecterAnomalies(): void {
    // Fallback local si API IA indisponible
    this.anomaliesDetectees = [];
    
    const recentReclamations = this.reclamations.filter(rec => 
      this.getDaysSince(rec.dateCreation) <= 1
    );
    
    if (recentReclamations.length > 5) {
      this.anomaliesDetectees.push({
        type: 'SPIKE_RECLAMATIONS',
        niveau: 'HAUT',
        description: `Pic de réclamations: ${recentReclamations.length} aujourd'hui`,
        actionRecommandee: 'Investiguer la cause du pic'
      });
    }
    
    const clientCounts = this.getClientReclamationCounts();
    const irriteClients = clientCounts.filter(c => c.count > 2);
    
    if (irriteClients.length > 0) {
      this.anomaliesDetectees.push({
        type: 'CLIENT_IRRITE',
        niveau: 'MOYEN',
        description: `${irriteClients.length} clients avec >2 réclamations`,
        actionRecommandee: 'Contacter les clients prioritairement'
      });
    }
    
    const typeCounts = this.getTypeReclamationCounts();
    const recurrentProblems = typeCounts.filter(t => t.count > 3);
    
    if (recurrentProblems.length > 0) {
      const topProblem = recurrentProblems[0];
      this.anomaliesDetectees.push({
        type: 'PROBLEME_RECURRENT',
        niveau: 'MOYEN',
        description: `Problème récurrent: ${topProblem.type} (${topProblem.count}x)`,
        actionRecommandee: 'Analyser et résoudre le problème système'
      });
    }
  }

  classifierReclamations(): void {
    // Analyser chaque réclamation avec l'IA
    this.reclamations.forEach(rec => {
      if (!this.reclamationsAnalysis[rec.id]) {
        this.analyserReclamationIA(rec);
      }
    });
  }

  analyserReclamationIA(reclamation: any): void {
    // Appel API réel pour analyser une réclamation
    this.apiService.analyserReclamation(
      reclamation.id,
      reclamation.description || '',
      reclamation.type || reclamation.objet,
      reclamation.clientId,
      reclamation.commandeId,
      reclamation.dateCreation
    ).subscribe({
      next: (analysis) => {
        this.reclamationsAnalysis[reclamation.id] = analysis;
      },
      error: (err) => {
        console.error('Erreur analyse réclamation:', err);
        // Fallback vers analyse rule-based locale
        this.reclamationsAnalysis[reclamation.id] = this.analyserReclamationRuleBased(reclamation);
      }
    });
  }

  analyserReclamationRuleBased(reclamation: any): any {
    // Fallback rule-based local
    const description = (reclamation.description || '').toLowerCase();
    const type = (reclamation.type || reclamation.objet || '').toLowerCase();
    
    let sentiment = 'NEUTRE';
    let problemeDetecte = 'Problème standard';
    let suggestionAction = 'Réponse standard';
    let tempsResolutionEstime = 24;
    
    if (description.includes('furieux') || description.includes('énervé') || 
        description.includes('colère') || description.includes('inacceptable')) {
      sentiment = 'NEGATIF';
      tempsResolutionEstime = 4;
    } else if (description.includes('merci') || description.includes('satisfait')) {
      sentiment = 'POSITIF';
    }
    
    if (type.includes('retard') || description.includes('retard')) {
      problemeDetecte = 'Retard de livraison';
      suggestionAction = 'Vérifier statut et proposer compensation';
      tempsResolutionEstime = 8;
    } else if (type.includes('perdu') || description.includes('perdu')) {
      problemeDetecte = 'Colis perdu';
      suggestionAction = 'Lancer enquête et proposer remboursement';
      tempsResolutionEstime = 48;
    } else if (type.includes('endommagé') || description.includes('cassé')) {
      problemeDetecte = 'Colis endommagé';
      suggestionAction = 'Demander photos et proposer remplacement';
      tempsResolutionEstime = 24;
    } else if (type.includes('paiement') || description.includes('paiement')) {
      problemeDetecte = 'Problème paiement';
      suggestionAction = 'Vérifier bordereau et régulariser';
      tempsResolutionEstime = 12;
    }
    
    return {
      priorite: tempsResolutionEstime <= 8 ? 'URGENT' : (tempsResolutionEstime <= 24 ? 'NORMAL' : 'FAIBLE'),
      sentiment,
      problemeDetecte,
      suggestionAction,
      tempsResolutionEstime,
      confidence: 0.6
    };
  }

  getClientReclamationCounts(): { clientId: string; count: number }[] {
    const counts: { [clientId: string]: number } = {};
    this.reclamations.forEach(rec => {
      if (rec.clientId) {
        counts[rec.clientId] = (counts[rec.clientId] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([clientId, count]) => ({ clientId, count }))
      .sort((a, b) => b.count - a.count);
  }

  getTypeReclamationCounts(): { type: string; count: number }[] {
    const counts: { [type: string]: number } = {};
    this.reclamations.forEach(rec => {
      const type = rec.type || rec.objet || 'Autre';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  actionAnomalie(anomalie: any): void {
    this.showToast(`Action: ${anomalie.actionRecommandee}`, 'info');
    // Implémenter l'action selon le type d'anomalie
  }

  // ========== MODAL DÉTAIL RÉCLAMATION ==========
  
  voirDetailReclamation(reclamation: any): void {
    this.selectedReclamation = reclamation;
    this.selectedReclamationAnalysis = this.reclamationsAnalysis[reclamation.id] || this.analyserReclamationIA(reclamation);
    this.adminCommentaire = reclamation.adminCommentaire || '';
    this.showReclamationDetail = true;
  }

  closeReclamationDetail(): void {
    this.showReclamationDetail = false;
    this.selectedReclamation = null;
    this.selectedReclamationAnalysis = null;
    this.adminCommentaire = '';
  }

  ajouterCommentaireAdmin(): void {
    if (!this.selectedReclamation || !this.adminCommentaire.trim()) return;
    
    this.apiService.updateReclamation(this.selectedReclamation.id, {
      ...this.selectedReclamation,
      adminCommentaire: this.adminCommentaire
    }).subscribe({
      next: () => {
        this.showToast('Commentaire ajouté', 'success');
        this.refreshData();
        this.closeReclamationDetail();
      },
      error: (err) => {
        console.error('Error adding comment:', err);
        this.showToast('Erreur lors de l\'ajout du commentaire', 'error');
      }
    });
  }

  // ========== RÉPONSE IA ==========
  
  genererReponseIA(reclamation: any): void {
    this.selectedReclamation = reclamation;
    this.showResponseModal = true;
    this.activeResponseTab = 'EMPATHIQUE';
    
    // Préparer le contexte pour l'IA
    const contexte = {
      client_name: this.getReclamationClientName(reclamation.clientId),
      ref_commande: reclamation.commandeId || reclamation.codeBarre || 'N/A',
      ref_reclamation: reclamation.id?.substring(0, 8) || 'N/A',
      statut: reclamation.statut || 'EN_ATTENTE',
      probleme: this.reclamationsAnalysis[reclamation.id]?.problemeDetecte || 'Problème signalé',
      temps_estime: this.reclamationsAnalysis[reclamation.id]?.tempsResolutionEstime || 24
    };
    
    // Générer les 3 types de réponses via API
    this.suggestedResponses = [];
    
    // Générer réponse empathique par défaut
    this.apiService.genererReponseReclamation(
      reclamation.id,
      'EMPATHIQUE',
      contexte
    ).subscribe({
      next: (response) => {
        this.suggestedResponses.push({
          type: 'EMPATHIQUE',
          texte: response.texte,
          confidence: response.confidence
        });
        this.responseText = this.getActiveResponseText();
      },
      error: (err) => {
        console.error('Erreur génération réponse empathique:', err);
        // Fallback template
        this.suggestedResponses.push({
          type: 'EMPATHIQUE',
          texte: this.genererReponseEmpathique(reclamation),
          confidence: 0.75
        });
        this.responseText = this.getActiveResponseText();
      }
    });
    
    // Générer les autres types en arrière-plan
    this.apiService.genererReponseReclamation(reclamation.id, 'FORMELLE', contexte).subscribe({
      next: (response) => {
        this.suggestedResponses.push({
          type: 'FORMELLE',
          texte: response.texte,
          confidence: response.confidence
        });
      },
      error: () => {
        this.suggestedResponses.push({
          type: 'FORMELLE',
          texte: this.genererReponseFormelle(reclamation),
          confidence: 0.75
        });
      }
    });
    
    this.apiService.genererReponseReclamation(reclamation.id, 'TECHNIQUE', contexte).subscribe({
      next: (response) => {
        this.suggestedResponses.push({
          type: 'TECHNIQUE',
          texte: response.texte,
          confidence: response.confidence
        });
      },
      error: () => {
        this.suggestedResponses.push({
          type: 'TECHNIQUE',
          texte: this.genererReponseTechnique(reclamation),
          confidence: 0.75
        });
      }
    });
  }

  genererReponseFormelle(reclamation: any): string {
    const clientName = this.getReclamationClientName(reclamation.clientId);
    const ref = reclamation.commandeId || reclamation.codeBarre || 'votre commande';
    const probleme = this.reclamationsAnalysis[reclamation.id]?.problemeDetecte || 'votre réclamation';
    
    return `Madame, Monsieur ${clientName},\n\nNous accusons réception de votre réclamation concernant ${probleme} (Réf: ${ref}).\n\nVotre dossier a été enregistré sous la référence ${reclamation.id?.substring(0, 8)} et est actuellement en cours de traitement par notre service client.\n\nNous vous informerons de l'avancement de votre dossier dans les plus brefs délais.\n\nCordialement,\nLe service client BFExpress`;
  }

  genererReponseEmpathique(reclamation: any): string {
    const clientName = this.getReclamationClientName(reclamation.clientId);
    const ref = reclamation.commandeId || reclamation.codeBarre || 'votre commande';
    
    return `Cher/Chère ${clientName},\n\nNous sommes vraiment désolés d'apprendre votre mécontentement concernant votre commande ${ref}. Nous comprenons parfaitement votre situation et nous allons faire notre possible pour la résoudre rapidement.\n\nNotre équipe s'occupe personnellement de votre dossier (Réf: ${reclamation.id?.substring(0, 8)}) et vous recontactera dans les plus brefs délais.\n\nMerci de votre patience et de votre compréhension.\n\nBien cordialement,\nL'équipe BFExpress`;
  }

  genererReponseTechnique(reclamation: any): string {
    const ref = reclamation.commandeId || reclamation.codeBarre || 'N/A';
    const statut = reclamation.statut || 'EN_ATTENTE';
    const probleme = this.reclamationsAnalysis[reclamation.id]?.problemeDetecte || 'Problème signalé';
    
    return `Suivi technique - Réclamation ${reclamation.id?.substring(0, 8)}\n\nCommande concernée: ${ref}\nStatut actuel: ${statut}\nProblème identifié: ${probleme}\n\nActions en cours:\n- Vérification du statut de la commande\n- Analyse du parcours de livraison\n- Contact avec le livreur si nécessaire\n\nDélai estimé de résolution: ${this.reclamationsAnalysis[reclamation.id]?.tempsResolutionEstime || 24}h\n\nVous serez notifié automatiquement de la résolution.`;
  }

  getActiveResponseText(): string {
    const active = this.suggestedResponses.find(r => r.type === this.activeResponseTab);
    return active?.texte || '';
  }

  getActiveResponseConfidence(): number {
    const active = this.suggestedResponses.find(r => r.type === this.activeResponseTab);
    return active ? Math.round(active.confidence * 100) : 0;
  }

  closeResponseModal(): void {
    this.showResponseModal = false;
    this.suggestedResponses = [];
    this.responseText = '';
    this.selectedReclamation = null;
  }

  envoyerReponse(): void {
    if (!this.selectedReclamation || !this.responseText.trim()) return;
    
    // Ici vous pouvez implémenter l'envoi réel de la réponse
    // Par email, notification, ou ajout comme commentaire
    
    this.apiService.updateReclamation(this.selectedReclamation.id, {
      ...this.selectedReclamation,
      adminCommentaire: `Réponse envoyée: ${this.responseText}`,
      statut: 'EN_COURS'
    }).subscribe({
      next: () => {
        this.showToast('Réponse envoyée avec succès', 'success');
        this.refreshData();
        this.closeResponseModal();
      },
      error: (err) => {
        console.error('Error sending response:', err);
        this.showToast('Erreur lors de l\'envoi de la réponse', 'error');
      }
    });
  }

  getDepartVille(order: Commande): string {
    return order.adresseDepart?.ville || 'Tunis';
  }

  getArriveeVille(order: Commande): string {
    return order.adresseArrivee?.ville || (order as any).ville || '—';
  }

  getOrderStatusClass(order: Commande): string {
    return 'status-' + (order.statut || 'EN_ATTENTE').toLowerCase();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/home']);
  }
}