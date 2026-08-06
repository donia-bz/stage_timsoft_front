import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Commande, Livreur } from '../../services/api.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { Router } from '@angular/router';

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
  photoUrl?: string; // NOUVEAU
  type?: string; // NOUVEAU
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
export class DashboardAdminComponent implements OnInit {
  activeTab: 'stats' | 'commandes' | 'livreurs' | 'carte' | 'manifests' | 'vehicules' | 'depots' | 'inscriptions' | 'reclamations' | 'analytics' | 'parametres' = 'stats';
  commandes: Commande[] = [];
  livreurs: Livreur[] = [];
  usersList: UserProfile[] = [];
  depots: Depot[] = [];
  vehicules: Vehicule[] = [];
  manifests: any[] = []; // Pour la gestion des manifests

  // Toasts
  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;

  // Stats and history
  deliveriesHistory: any[] = [];
  showHistoryPanel = false;
  historyForOrderId: string | null = null;
  stats: any = { avgDeliveryMin: 0, avgDelayMin: 0, commandesCount: 0, revenus: 0, driverPerformance: {}, successRate: 0, satisfactionRate: 0, satisfactionScore: 0 };

  // User detail modal
  showUserPanel = false;
  selectedUser: UserProfile | null = null;

  // Selected driver for manual assignment mapped by order ID
  selectedDrivers: { [key: string]: string } = {};

  // AI assignment scores mapped by order ID for displaying prediction results
  aiPredictions: { [key: string]: { driverName: string; score: number } } = {};

  // Assignment panel state
  assignmentPanelOrderId: string | null = null;

  // Gestion des livreurs - Gouvernorats tunisiens
  gouvernorats: string[] = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
    'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir',
    'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès',
    'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
  ];

  // Formulaire nouveau livreur
  nouveauLivreur: any = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    gouvernorat: '',
    typePermis: 'B',
    statut: 'INSCRIPTION',
    photoUrl: '' // NOUVEAU
  };

  // Formulaire nouveau véhicule
  nouveauVehicule: any = {
    immatriculation: '',
    modele: '',
    marque: '',
    type: 'Voiture',
    capacite: 10,
    statut: 'DISPONIBLE',
    photoUrl: '' // NOUVEAU
  };

  // Formulaire nouveau dépôt
  nouveauDepot: any = {
    nom: '',
    ville: '',
    capacite: 100
  };

  // Mode édition
  modeEditionLivreur: boolean = false;
  livreurEnEdition: string | null = null;

  // Search filter
  searchFilter: string = '';
  private adminMap: any = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  // --- CUSTOM TOAST SYSTEM ---
  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = this.toastIdCounter++;
    this.toasts.push({ id, message, type });
    setTimeout(() => {
      this.removeToast(id);
    }, 4000); // disparait après 4s
  }

  removeToast(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
  // ---------------------------

  ngOnInit(): void {
    this.refreshData();
  }

  get filteredCommandes(): Commande[] {
    if (!this.searchFilter.trim()) return this.commandes;
    const q = this.searchFilter.toLowerCase();
    return this.commandes.filter(c => 
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.statut && c.statut.toLowerCase().includes(q)) ||
      (c.typeService && c.typeService.toLowerCase().includes(q))
    );
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
      // Centre sur la Tunisie (Tunis)
      this.adminMap = L.map('admin-map').setView([36.8065, 10.1815], 9);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.adminMap);

      // Ajouter marqueurs pour chaque livreur
      this.livreurs.forEach(l => {
        const lat = l.latitudeActuelle || 36.8065 + (Math.random() - 0.5) * 0.2;
        const lon = l.longitudeActuelle || 10.1815 + (Math.random() - 0.5) * 0.2;
        const statusColor = l.statut === 'DISPONIBLE' ? 'green' : (l.statut === 'EN_COURSE' ? 'orange' : 'red');
        
        const popupText = `<b>${l.nom} ${l.prenom}</b><br>Statut: ${l.statut || 'DISPONIBLE'}<br>Gouvernorat: ${l.gouvernorat || 'Tunis'}`;
        L.marker([lat, lon]).addTo(this.adminMap).bindPopup(popupText);
      });
    }, 200);
  }

  refreshData(): void {
    // Fetch orders
    this.apiService.getAllCommandes().subscribe({
      next: (res) => {
        this.commandes = res;
        this.updateDepotOccupancy();
        this.computeStats();
      },
      error: (err) => console.error('Error fetching orders:', err)
    });

    // Fetch users (for approvals)
    this.authService.getAllUsers().subscribe({
      next: (res) => {
        this.usersList = res;
        this.mergePendingLivreurUsers();
      },
      error: (err) => console.error('Error fetching users:', err)
    });

    // Fetch drivers
    this.apiService.getAllLivreurs().subscribe({
      next: (res) => {
        this.livreurs = res;
        this.mergePendingLivreurUsers();
        this.updateDepotOccupancy();
        this.computeStats();
      },
      error: (err) => {
        console.error('Error fetching drivers:', err);
        this.mergePendingLivreurUsers();
      }
    });

    // Load persisted depots/vehicules from localStorage as a fallback
    try {
      const d = localStorage.getItem('bf_depots');
      const v = localStorage.getItem('bf_vehicules');
      this.depots = d ? JSON.parse(d) : [];
      this.vehicules = v ? JSON.parse(v) : [];
      this.updateDepotOccupancy();
    } catch (e) {
      this.depots = [];
      this.vehicules = [];
    }
  }

  // Fusionner les candidatures livreur (auth) avec la liste livreurs
  mergePendingLivreurUsers(): void {
    const pendingUsers = this.usersList.filter(u =>
      u.role === 'LIVREUR' && (u.statut === 'INSCRIPTION' || u.approuve === false)
    );

    pendingUsers.forEach(u => {
      const exists = this.livreurs.some(l =>
        l.email === u.email || l.id === u.id
      );
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
        });
      }
    });
  }

  updateDepotOccupancy(): void {
    this.depots.forEach(depot => {
      const ville = (depot.ville || '').toLowerCase();
      depot.colisActuels = this.commandes.filter(c => {
        const departVille = (c.adresseDepart?.ville || '').toLowerCase();
        const statut = c.statut || '';
        return departVille === ville && statut !== 'LIVREE' && statut !== 'ANNULEE';
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

  // Filter pending approvals
  getPendingApprovals(): UserProfile[] {
    return this.usersList.filter(u => u.statut === 'INSCRIPTION' || u.approuve === false);
  }

  // Filter approved users
  getApprovedUsers(): UserProfile[] {
    return this.usersList.filter(u => u.statut !== 'INSCRIPTION' && u.approuve !== false);
  }

  getPendingUsersCount(): number {
    return this.getPendingApprovals().length;
  }

  // Delete a user
  deleteUser(user: UserProfile): void {
    if (!confirm(`Supprimer définitivement ${user.prenom} ${user.nom} ?`)) return;

    this.authService.supprimerUtilisateur(user.id).subscribe({
      next: () => {
        this.showToast('Utilisateur supprimé.', 'success');
        this.refreshData();
      },
      error: () => {
        this.usersList = this.usersList.filter(u => u.id !== user.id);
        this.showToast('Utilisateur supprimé (mode local).', 'info');
      }
    });
  }

  viewUserDetails(user: UserProfile): void {
    this.selectedUser = user;
    this.showUserPanel = true;
  }

  closeUserPanel(): void {
    this.showUserPanel = false;
    this.selectedUser = null;
  }

  approveUser(userId: string): void {
    this.authService.approuverUtilisateur(userId).subscribe({
      next: () => {
        this.showToast('Utilisateur approuvé avec succès !', 'success');
        this.refreshData();
      },
      error: () => {
        const user = this.usersList.find(u => u.id === userId);
        if (user) {
          user.approuve = true;
          user.statut = 'ACTIF';
        }
        this.showToast('Utilisateur approuvé (mode local).', 'info');
      }
    });
  }

  // Manual delivery driver assignment
  assignDriverManually(order: Commande): void {
    const driverId = this.selectedDrivers[order.id || ''];
    if (!driverId) {
      this.showToast('Veuillez sélectionner un livreur.', 'error');
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
                this.showToast('Livreur affecté manuellement avec succès!', 'success');
                this.refreshData();
              }
            });
          }
        });
      },
      error: (err) => this.showToast("Erreur d'affectation : " + err.message, 'error')
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
    const depot = { id: 'DEP' + Date.now(), nom, ville, capacite, colisActuels: 0 };
    this.depots.push(depot);
    this.updateDepotOccupancy();
  }

  removeDepot(id: string) {
    this.depots = this.depots.filter(d => d.id !== id);
    localStorage.setItem('bf_depots', JSON.stringify(this.depots));
  }

  addVehicule(immatriculation: string, modele: string, capacite: number) {
    const v = {
      id: 'VEH' + Date.now(),
      immatriculation,
      modele,
      capacite,
      statut: 'DISPONIBLE',
      dateAjout: new Date().toISOString(),
      photoUrl: this.nouveauVehicule.photoUrl || '',
      type: this.nouveauVehicule.type || 'Voiture'
    };
    this.vehicules.push(v);
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
    this.showToast('Véhicule ajouté', 'success');
  }

  addVehiculeAndReset() {
    this.addVehicule(this.nouveauVehicule.immatriculation, this.nouveauVehicule.modele, this.nouveauVehicule.capacite);
    this.nouveauVehicule = { capacite: 10, type: 'Voiture', statut: 'DISPONIBLE', photoUrl: '' };
  }

  openCarteTab() {
    this.activeTab = 'carte';
    this.initMapAdmin();
  }

  addDepotAndReset() {
    this.addDepot(this.nouveauDepot.nom, this.nouveauDepot.ville, this.nouveauDepot.capacite);
    this.nouveauDepot = { nom: '', ville: '', capacite: 100 };
  }

  // Helper methods for template bindings
  getActiveDriversCount(): number {
    return this.livreurs.filter(l => l.statut === 'DISPONIBLE' || l.statut === 'EN_COURSE').length;
  }

  getDepartVille(order: Commande): string {
    return order.adresseDepart?.ville || 'Tunis';
  }

  getArriveeVille(order: Commande): string {
    return order.adresseArrivee?.ville || 'Sousse';
  }

  getOrderStatus(order: Commande): string {
    return order.statut || 'EN_ATTENTE';
  }

  getOrderStatusClass(order: Commande): string {
    return 'status-' + (order.statut || 'EN_ATTENTE').toLowerCase();
  }

  getLivreurGouvernorat(livreur: Livreur): string {
    return livreur.gouvernorat || 'Tunis';
  }

  getLivreurCoordLat(livreur: Livreur): number {
    return livreur.latitudeActuelle || 36.8;
  }

  getLivreurCoordLon(livreur: Livreur): number {
    return livreur.longitudeActuelle || 10.1;
  }

  getLivreurNote(livreur: Livreur): string {
    return String(livreur.noteMoyenne || 4.8);
  }

  getUserRole(user: UserProfile): string {
    return user.role || 'client';
  }

  getVehicleTypeDisplay(vehicle: Vehicule): string {
    return vehicle.type || 'Voiture';
  }

  getStatsAvgDelivery(): number {
    return this.stats.avgDeliveryMin || 0;
  }

  getStatsSuccessRate(): number {
    return this.stats.successRate || 0;
  }

  getStatsSatisfaction(): number {
    return this.stats.satisfactionScore || 0;
  }

  isOrderPending(order: Commande): boolean {
    return order.statut === 'EN_ATTENTE' || !order.statut;
  }

  removeVehicule(id: string) {
    this.vehicules = this.vehicules.filter(v => v.id !== id);
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
  }

  cycleVehicleStatus(vehicule: any): void {
    const states = ['DISPONIBLE', 'EN_UTILISATION', 'EN_PANNE'];
    const idx = states.indexOf(vehicule.statut || 'DISPONIBLE');
    vehicule.statut = states[(idx + 1) % states.length];
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
  }

  updateVehicleCapacity(vehicleId: string, newCapacity: number): void {
    const vehicle = this.vehicules.find(v => v.id === vehicleId);
    if (vehicle) {
      vehicle.capacite = newCapacity;
      localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
      this.showToast('Capacité mise à jour', 'success');
    }
  }

  updateVehicleStatus(vehicleId: string, newStatus: string): void {
    const vehicle = this.vehicules.find(v => v.id === vehicleId);
    if (vehicle) {
      vehicle.statut = newStatus;
      localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
      this.showToast('État mis à jour', 'success');
    }
  }

  deleteVehicle(vehicleId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?')) {
      this.vehicules = this.vehicules.filter(v => v.id !== vehicleId);
      localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
      this.showToast('Véhicule supprimé', 'success');
    }
  }

  uploadVehiclePhoto(vehicleId: string, event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const vehicle = this.vehicules.find(v => v.id === vehicleId);
        if (vehicle) {
          vehicle.photoUrl = e.target.result;
          localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
          this.showToast('Photo mise à jour', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  }

  uploadNewVehiclePhoto(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.nouveauVehicule.photoUrl = e.target.result;
        this.showToast('Photo chargée', 'success');
      };
      reader.readAsDataURL(file);
    }
  }

  getVehicleStatusLabel(statut: string): string {
    const labels: Record<string, string> = {
      'DISPONIBLE': 'Opérationnel',
      'EN_UTILISATION': 'En service',
      'EN_PANNE': 'En panne'
    };
    return labels[statut] || statut;
  }

  getVehicleStatusClass(statut: string): string {
    if (statut === 'EN_PANNE') return 'vehicule-panne';
    if (statut === 'EN_UTILISATION') return 'vehicule-service';
    return 'vehicule-ok';
  }

  // === GESTION DES LIVREURS ===

  // Enregistrer un nouveau livreur
  enregistrerLivreur() {
    if (!this.nouveauLivreur.nom || !this.nouveauLivreur.prenom || !this.nouveauLivreur.gouvernorat) {
      this.showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    const nouveauLivreur: Livreur = {
      id: 'LIV-' + Date.now(),
      nom: this.nouveauLivreur.nom,
      prenom: this.nouveauLivreur.prenom,
      email: this.nouveauLivreur.email,
      telephone: this.nouveauLivreur.telephone,
      gouvernorat: this.nouveauLivreur.gouvernorat,
      typePermis: this.nouveauLivreur.typePermis,
      statut: 'INSCRIPTION',
      dateInscription: new Date().toISOString(),
      noteMoyenne: 0,
      nombreLivraisons: 0
    };

    this.apiService.creerLivreur(nouveauLivreur).subscribe({
      next: (livreur) => {
        this.livreurs.push(livreur);
        this.resetLivreurForm();
        this.showToast('Livreur enregistré avec succès ! Un email de confirmation sera envoyé.', 'success');
        this.refreshData();
      },
      error: (err) => {
        // En mode local si backend non disponible
        this.livreurs.push(nouveauLivreur);
        this.resetLivreurForm();
        this.showToast('Livreur enregistré en mode local (backend non disponible)', 'info');
      }
    });
  }

  // Valider l'inscription d'un livreur
  validerLivreur(livreurId: string) {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (livreur) {
      livreur.statut = 'DISPONIBLE';
      this.apiService.updateLivreurStatut(livreurId, 'DISPONIBLE').subscribe({
        next: () => {
          this.showToast(`Livreur ${livreur.prenom} ${livreur.nom} validé !`, 'success');
          this.refreshData();
        },
        error: () => {
          this.showToast('Livreur validé en mode local', 'info');
          this.refreshData();
        }
      });
    }
  }

  voirDetailsLivreur(l: Livreur): void {
    alert(`Détails du Livreur :\n\nNom: ${l.nom} ${l.prenom}\nEmail: ${l.email}\nTéléphone: ${l.telephone}\nGouvernorat: ${l.gouvernorat}\nPermis: ${l.typePermis}`);
  }

  // Delete driver
  supprimerLivreur(lId: string): void {
    const l = this.livreurs.find(liv => liv.id === lId);
    if (!l) return;
    if (!confirm(`Voulez-vous vraiment supprimer le livreur ${l.nom} ${l.prenom} ?`)) return;
    
    this.apiService.deleteLivreur(lId).subscribe({
      next: () => {
        this.showToast('Livreur supprimé avec succès.', 'success');
        this.refreshData();
      },
      error: () => {
        this.livreurs = this.livreurs.filter(liv => liv.id !== lId);
        this.showToast('Livreur supprimé (mode local).', 'info');
      }
    });
  }

  // Valider et affecter le gouvernorat en même temps
  affecterGouvernoratEtValider(livreur: Livreur) {
    // On met à jour le gouvernorat
    this.apiService.updateLivreur(livreur.id, { gouvernorat: livreur.gouvernorat }).subscribe({
      next: () => {
        // Ensuite on valide
        this.validerLivreur(livreur.id);
      },
      error: () => {
        // Fallback local
        this.validerLivreur(livreur.id);
      }
    });
  }

  // Affecter un livreur à un gouvernorat
  affecterGouvernorat(livreurId: string, gouvernorat: string) {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (livreur) {
      livreur.gouvernorat = gouvernorat;
      this.apiService.updateLivreur(livreurId, { gouvernorat }).subscribe({
        next: () => {
          this.showToast(`Livreur affecté à ${gouvernorat}`, 'success');
          this.refreshData();
        },
        error: () => {
          this.showToast('Affectation enregistrée en mode local', 'info');
          this.refreshData();
        }
      });
    }
  }

  // Suspendre un livreur
  suspendreLivreur(livreurId: string) {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (livreur) {
      livreur.statut = 'SUSPENDU';
      this.apiService.updateLivreurStatut(livreurId, 'SUSPENDU').subscribe({
        next: () => {
          this.showToast('Livreur suspendu', 'success');
          this.refreshData();
        },
        error: () => {
          this.showToast('Livreur suspendu en mode local', 'info');
          this.refreshData();
        }
      });
    }
  }

  // Réactiver un livreur
  reactiverLivreur(livreurId: string) {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (livreur) {
      livreur.statut = 'DISPONIBLE';
      this.apiService.updateLivreurStatut(livreurId, 'DISPONIBLE').subscribe({
        next: () => {
          this.showToast('Livreur réactivé', 'success');
          this.refreshData();
        },
        error: () => {
          this.showToast('Livreur réactivé en mode local', 'info');
          this.refreshData();
        }
      });
    }
  }

  // Modifier un livreur
  modifierLivreur(livreur: Livreur) {
    this.modeEditionLivreur = true;
    this.livreurEnEdition = livreur.id;
    this.nouveauLivreur = { ...livreur };
  }

  // Annuler édition
  annulerEdition() {
    this.modeEditionLivreur = false;
    this.livreurEnEdition = null;
    this.resetLivreurForm();
  }

  // Sauvegarder modifications
  sauvegarderLivreur() {
    if (this.livreurEnEdition) {
      const livreur = this.livreurs.find(l => l.id === this.livreurEnEdition);
      if (livreur) {
        Object.assign(livreur, this.nouveauLivreur);
        this.apiService.updateLivreur(this.livreurEnEdition, this.nouveauLivreur).subscribe({
          next: () => {
            alert('Livreur modifié avec succès');
            this.annulerEdition();
            this.refreshData();
          },
          error: () => {
            alert('Modifications enregistrées en mode local');
            this.annulerEdition();
            this.refreshData();
          }
        });
      }
    }
  }

  // Reset formulaire livreur
  resetLivreurForm() {
    this.nouveauLivreur = {
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      gouvernorat: '',
      typePermis: 'B',
      statut: 'INSCRIPTION'
    };
  }

  // === GESTION DES VÉHICULES ===

  // Enregistrer un nouveau véhicule
  enregistrerVehicule() {
    if (!this.nouveauVehicule.immatriculation || !this.nouveauVehicule.modele) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const nouveauVehicule = {
      id: 'VEH-' + Date.now(),
      ...this.nouveauVehicule,
      dateAjout: new Date().toISOString()
    };

    this.vehicules.push(nouveauVehicule);
    localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
    this.resetVehiculeForm();
    alert('Véhicule enregistré avec succès !');
  }

  // Affecter un véhicule à un livreur
  affecterVehicule(vehiculeId: string, livreurId: string) {
    const vehicule = this.vehicules.find(v => v.id === vehiculeId);
    const livreur = this.livreurs.find(l => l.id === livreurId);
    
    if (vehicule && livreur) {
      livreur.vehiculeId = vehiculeId;
      vehicule.statut = 'EN_UTILISATION';
      
      localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
      alert(`Véhicule ${vehicule.immatriculation} affecté à ${livreur.prenom} ${livreur.nom}`);
      this.refreshData();
    }
  }

  // Libérer un véhicule
  libererVehicule(vehiculeId: string) {
    const vehicule = this.vehicules.find(v => v.id === vehiculeId);
    const livreur = this.livreurs.find(l => l.vehiculeId === vehiculeId);
    
    if (vehicule && livreur) {
      livreur.vehiculeId = undefined;
      vehicule.statut = 'DISPONIBLE';
      
      localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
      alert('Véhicule libéré');
      this.refreshData();
    }
  }

  // Reset formulaire véhicule
  resetVehiculeForm() {
    this.nouveauVehicule = {
      immatriculation: '',
      modele: '',
      marque: '',
      type: 'Voiture',
      capacite: 10,
      statut: 'DISPONIBLE'
    };
  }

  // === GESTION DES MANIFESTS ===

  // Charger les manifests validés par les clients
  chargerManifests() {
    this.apiService.getAllManifestes().subscribe({
      next: (manifests) => {
        this.manifests = manifests.filter(m => m.statut === 'IMPRIME' || m.statut === 'VALIDE');
      },
      error: (err) => {
        console.error('Erreur chargement manifests:', err);
        this.manifests = [];
      }
    });
  }

  // Affecter un manifest à un livreur
  affecterManifest(manifestId: string, livreurId: string) {
    const manifest = this.manifests.find(m => m.id === manifestId);
    const livreur = this.livreurs.find(l => l.id === livreurId);
    
    if (manifest && livreur) {
      manifest.livreurId = livreurId;
      manifest.statut = 'A_ENLEVER';
      
      this.apiService.updateManifeste(manifestId, manifest).subscribe({
        next: () => {
          alert(`Manifest affecté à ${livreur.prenom} ${livreur.nom}`);
          this.refreshData();
        },
        error: () => {
          alert('Affectation enregistrée en mode local');
          this.refreshData();
        }
      });
    }
  }

  // Valider le retrait d'un manifest
  validerRetraitManifest(manifestId: string) {
    const manifest = this.manifests.find(m => m.id === manifestId);
    if (manifest) {
      manifest.statut = 'EN_LIVRAISON';
      
      this.apiService.updateManifeste(manifestId, manifest).subscribe({
        next: () => {
          alert('Manifest validé et mis en livraison');
          this.refreshData();
        },
        error: () => {
          alert('Validation enregistrée en mode local');
          this.refreshData();
        }
      });
    }
  }

  // Compute basic statistics from commandes + livraisons
  computeStats() {
    const commandes = this.commandes || [];
    this.stats.commandesCount = commandes.length;
    this.stats.revenus = this.getTotalRevenue();

    const livree = this.getOrderCountByStatus('LIVREE');
    const totalFinished = livree + this.getOrderCountByStatus('RETOUR_DEPOT') + this.getOrderCountByStatus('ANNULEE');
    this.stats.successRate = totalFinished > 0 ? Math.round((livree / totalFinished) * 1000) / 10 : 0;

    const notes = this.livreurs.filter(l => l.noteMoyenne && l.noteMoyenne > 0).map(l => l.noteMoyenne!);
    this.stats.satisfactionScore = notes.length
      ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
      : 0;
    this.stats.satisfactionRate = Math.round((this.stats.satisfactionScore / 5) * 1000) / 10;

    this.apiService.getAllLivraisons().subscribe({
      next: (livs) => {
        const finished = livs.filter(l => l.dateDebut && l.dateFin);
        const durations = finished.map(l => (new Date(l.dateFin!).getTime() - new Date(l.dateDebut!).getTime()) / 60000);
        this.stats.avgDeliveryMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

        const byDriver: any = {};
        livs.forEach(l => {
          const d = l.livreurId || 'unknown';
          if (!byDriver[d]) byDriver[d] = { count: 0, totalMin: 0 };
          if (l.dateDebut && l.dateFin) {
            const mins = (new Date(l.dateFin).getTime() - new Date(l.dateDebut).getTime()) / 60000;
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

    this.chargerManifests();
  }

  // === Méthodes utilitaires ===

  getAvailableDriversCount(): number {
    return this.livreurs.filter(l => l.statut === 'DISPONIBLE').length;
  }

  getDriversByGouvernorat(gouvernorat: string): Livreur[] {
    return this.livreurs.filter(l => l.gouvernorat === gouvernorat);
  }

  getPendingRegistrations(): Livreur[] {
    return this.livreurs.filter(l => l.statut === 'INSCRIPTION');
  }

  getAvailableVehicles(): any[] {
    return this.vehicules.filter(v => v.statut === 'DISPONIBLE');
  }

  getDriverByVehicle(vehicleId: string): Livreur | undefined {
    return this.livreurs.find(l => l.vehiculeId === vehicleId);
  }

  getDriverById(driverId: string): Livreur | undefined {
    return this.livreurs.find(l => l.id === driverId);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-TN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  assignVehicleToDriver(vehicleId: string) {
    // Simple prompt pour sélectionner un livreur disponible
    const availableDrivers = this.livreurs.filter(l => l.statut === 'DISPONIBLE' && !l.vehiculeId);
    if (availableDrivers.length === 0) {
      alert('Aucun livreur disponible sans véhicule');
      return;
    }
    
    const driverNames = availableDrivers.map((d, i) => `${i + 1}. ${d.prenom} ${d.nom} (${d.gouvernorat})`).join('\n');
    const selection = prompt(`Sélectionnez un livreur:\n${driverNames}\n\nEntrez le numéro:`);
    
    if (selection) {
      const index = parseInt(selection) - 1;
      if (index >= 0 && index < availableDrivers.length) {
        this.affecterVehicule(vehicleId, availableDrivers[index].id);
      }
    }
  }

  viewManifestDetails(manifestId: string) {
    alert(`Détails du manifest ${manifestId}\n\nFonctionnalité à implémenter avec le backend`);
  }

  // AI-optimized delivery driver assignment
  assignDriverAI(order: Commande): void {
    const orderId = order.id || '';
    if (!orderId) return;

    // Get available drivers
    const availableDrivers = this.livreurs.filter(l => l.statut === 'DISPONIBLE');
    if (availableDrivers.length === 0) {
      this.showToast("Aucun livreur disponible pour l'affectation IA.", 'info');
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
          this.showToast('L\'IA a recommandé un livreur introuvable.', 'error');
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
                      this.showToast('Affectation IA validée et enregistrée!', 'success');
                      this.refreshData();
                    }
                  });
                }
              });
            },
            error: (err) => this.showToast("Erreur lors de la livraison : " + err.message, 'error')
          });
        }
      },
      error: (err) => this.showToast("Erreur de calcul IA : " + err.message, 'error')
    });
  }

  // Toggle driver status
  toggleDriverStatus(driver: Livreur): void {
    const newStatus = driver.statut === 'DISPONIBLE' ? 'HORS_LIGNE' : 'DISPONIBLE';
    this.apiService.updateLivreurStatut(driver.id, newStatus).subscribe({
      next: (res) => {
        driver.statut = res.statut;
        this.showToast(`Statut du livreur mis à jour: ${newStatus}`, 'success');
      },
      error: (err) => this.showToast('Erreur lors de la mise à jour du statut', 'error')
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

  showAssignmentPanel(order: Commande): void {
    this.assignmentPanelOrderId = order.id || null;
  }

  closeAssignmentPanel(): void {
    this.assignmentPanelOrderId = null;
  }

  // === Méthodes utilitaires pour le template ===
  
  round(value: number): number {
    return Math.round(value);
  }

  getOrderCountByStatus(status: string): number {
    return this.commandes.filter(c => c.statut === status).length;
  }

  getOrderPercentage(status: string): number {
    const total = this.commandes.length;
    if (total === 0) return 0;
    return (this.getOrderCountByStatus(status) / total) * 100;
  }

  getTopDrivers(): Livreur[] {
    return this.livreurs.slice(0, 5);
  }

  getTotalRevenue(): number {
    return this.commandes.reduce((sum, cmd) => sum + (cmd.montantTotal || 0), 0);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/home']);
  }

  // === Méthodes pour les statistiques réelles ===
  
  getSatisfactionPercentage(): number {
    // Calculer le pourcentage de satisfaction basé sur les notes des livreurs
    const availableDrivers = this.livreurs.filter(l => l.statut === 'DISPONIBLE');
    if (availableDrivers.length === 0) return 0;
    
    const totalRating = availableDrivers.reduce((sum, driver) => sum + (driver.noteMoyenne || 0), 0);
    return Math.round((totalRating / availableDrivers.length) * 20); // Convertir note/5 en pourcentage
  }

  getSuccessRate(): number {
    // Calculer le taux de réussite = livrées / total
    const total = this.commandes.length;
    if (total === 0) return 0;
    
    const delivered = this.commandes.filter(c => c.statut === 'LIVREE').length;
    return Math.round((delivered / total) * 100);
  }

  getReturnRate(): number {
    // Calculer le taux de retour = retours / livrées
    const delivered = this.commandes.filter(c => c.statut === 'LIVREE').length;
    if (delivered === 0) return 0;
    
    const returned = this.commandes.filter(c => c.statut === 'RETOUR_DEPOT').length;
    return Math.round((returned / delivered) * 100);
  }

  getDailyAverage(): number {
    // Calculer la moyenne journalière de commandes
    const total = this.commandes.length;
    if (total === 0) return 0;
    
    // Supposons 30 jours pour le calcul
    return Math.round(total / 30);
  }

  // === Méthodes pour les véhicules avec suivi pannes ===
  
  getVehicleEtat(vehicle: any): string {
    return vehicle.etat || 'OPERATIONNEL';
  }

  getVehicleEtatIcon(vehicle: any): string {
    const etat = this.getVehicleEtat(vehicle);
    switch (etat) {
      case 'OPERATIONNEL': return '✅';
      case 'MAINTENANCE': return '🔧';
      case 'PANNE': return '⚠️';
      default: return '❓';
    }
  }

  voirDetailsVehicule(vehicle: any) {
    const details = `
=== Détails du véhicule ===
Marque: ${vehicle.marque}
Modèle: ${vehicle.modele}
Immatriculation: ${vehicle.immatriculation}
Type: ${vehicle.type}
Capacité: ${vehicle.capacite} colis
État: ${this.getVehicleEtat(vehicle)}
Kilométrage: ${vehicle.kilometrage || 0} km
Dernier entretien: ${vehicle.dernierEntretien || 'Jamais'}
Assigné à: ${this.getDriverForVehicle(vehicle.id || '')?.prenom || 'Non assigné'}
    `;
    alert(details);
  }

  modifierEtatVehicule(vehicle: any) {
    const etats = ['OPERATIONNEL', 'MAINTENANCE', 'PANNE'];
    const etatActuel = this.getVehicleEtat(vehicle);
    const options = etats.map((e, i) => `${i + 1}. ${e}`).join('\n');
    const selection = prompt(`État actuel: ${etatActuel}\n\nSélectionnez le nouvel état:\n${options}\n\nEntrez le numéro:`);
    
    if (selection) {
      const index = parseInt(selection) - 1;
      if (index >= 0 && index < etats.length) {
        vehicle.etat = etats[index];
        alert(`État du véhicule modifié: ${etats[index]}`);
      }
    }
  }

  supprimerVehicule(vehicleId: string) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?')) {
      this.vehicules = this.vehicules.filter(v => v.id !== vehicleId);
      alert('Véhicule supprimé');
    }
  }

  // === Méthodes de filtre pour le template ===
  
  getAvailableDrivers(): Livreur[] {
    return this.livreurs.filter(l => l.statut === 'DISPONIBLE');
  }

  getInProgressManifests(): any[] {
    return this.manifests.filter(m => m.statut === 'A_ENLEVER' || m.statut === 'EN_LIVRAISON');
  }

  getPendingManifests(): any[] {
    return this.manifests.filter(m => m.statut === 'IMPRIME' || m.statut === 'VALIDE');
  }

  getAllDriversForMap(): Livreur[] {
    return this.livreurs;
  }

  getAllLivreurs(): Livreur[] {
    return this.livreurs;
  }

  getLivreursForGouvernorat(gouvernorat: string): Livreur[] {
    return this.livreurs.filter(l => l.gouvernorat === gouvernorat);
  }

  getPendingRegistrationLivreurs(): Livreur[] {
    return this.livreurs.filter(l => l.statut === 'INSCRIPTION');
  }

  getAvailableVehiclesList(): any[] {
    return this.vehicules.filter(v => v.statut === 'DISPONIBLE');
  }

  getAllVehicles(): any[] {
    return this.vehicules;
  }

  getGouvernoratsList(): string[] {
    return this.gouvernorats;
  }

  getSelectedDriverForManifest(manifestId: string): string {
    return this.selectedDrivers[manifestId || ''] || '';
  }

  isManifestDriverSelected(manifestId: string): boolean {
    return !!this.selectedDrivers[manifestId || ''];
  }

  getDriverFirstInitial(driver: Livreur): string {
    return driver.prenom ? driver.prenom.charAt(0) : '';
  }

  getDriverFullName(driver: Livreur): string {
    return `${driver.prenom} ${driver.nom}`;
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

  getDriverVehicle(driver: Livreur): string {
    return driver.vehiculeId || 'Non assigné';
  }

  getDriverNote(driver: Livreur): number {
    return driver.noteMoyenne || 0;
  }

  getDriverDeliveryCountFromDriver(driver: Livreur): number {
    return driver.nombreLivraisons || 0;
  }

  getVehicleImmatriculation(vehicle: any): string {
    return vehicle.immatriculation || 'N/A';
  }

  getVehicleModel(vehicle: any): string {
    return vehicle.modele || 'N/A';
  }

  getVehicleStatus(vehicle: any): string {
    return vehicle.statut || 'INCONNU';
  }

  isVehicleAvailable(vehicle: any): boolean {
    return vehicle.statut === 'DISPONIBLE';
  }

  isVehicleInUse(vehicle: any): boolean {
    return vehicle.statut === 'EN_UTILISATION';
  }

  getVehicleCapacity(vehicle: any): number {
    return vehicle.capacite || 0;
  }

  getVehicleType(vehicle: any): string {
    return vehicle.type || 'N/A';
  }

  getDriverForVehicle(vehicleId: string): Livreur | undefined {
    return this.livreurs.find(l => l.vehiculeId === vehicleId);
  }

  getDriverDeliveryCount(driverId: string): number {
    return this.stats.driverPerformance[driverId]?.count || 0;
  }

  getManifestId(manifest: any): string {
    return manifest.id || 'N/A';
  }

  getManifestStatus(manifest: any): string {
    return manifest.statut || 'INCONNU';
  }

  getManifestClient(manifest: any): string {
    return manifest.clientId || 'N/A';
  }

  getManifestColisCount(manifest: any): number {
    return manifest.nombreColis || 0;
  }

  getManifestDate(manifest: any): string {
    return this.formatDate(manifest.dateCreation || '');
  }

  isManifestInProgress(manifest: any): boolean {
    return manifest.statut === 'A_ENLEVER' || manifest.statut === 'EN_LIVRAISON';
  }

  canValidateRetrait(manifest: any): boolean {
    return this.getManifestStatus(manifest) === 'A_ENLEVER';
  }

  getDriverByIdForManifest(livreurId: string): Livreur | undefined {
    return this.livreurs.find(l => l.id === livreurId);
  }

  getDriverNameForManifest(livreurId: string): string {
    const driver = this.getDriverByIdForManifest(livreurId);
    if (driver) {
      return `${driver.prenom} ${driver.nom}`;
    }
    return 'Non assigné';
  }

  hasNoManifests(): boolean {
    return this.manifests.length === 0;
  }

  getOrderStatusCount(status: string): number {
    return this.getOrderCountByStatus(status);
  }

  getEnAttenteCount(): number {
    return this.getOrderCountByStatus('EN_ATTENTE');
  }

  getEnLivraisonCount(): number {
    return this.getOrderCountByStatus('EN_LIVRAISON');
  }

  getLivreeCount(): number {
    return this.getOrderCountByStatus('LIVREE');
  }

  getRetourCount(): number {
    return this.getOrderCountByStatus('RETOUR_DEPOT');
  }

  getEnAttentePercentage(): number {
    return this.getOrderPercentage('EN_ATTENTE');
  }

  getEnLivraisonPercentage(): number {
    return this.getOrderPercentage('EN_LIVRAISON');
  }

  getLivreePercentage(): number {
    return this.getOrderPercentage('LIVREE');
  }

  getRetourPercentage(): number {
    return this.getOrderPercentage('RETOUR_DEPOT');
  }
}
