import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Commande, Livreur } from '../../services/api.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export interface Depot {
  id?: string;
  nom: string;
  ville?: string;
  gouvernorat?: string;
  capacite: number;
  colisActuels?: number;
  stats?: any;
  [key: string]: any;
}

export interface Vehicule {
  id?: string;
  immatriculation: string;
  marque?: string;
  modele: string;
  type?: string;
  capaciteKg?: number;
  capaciteVolume?: number;
  annee?: number;
  statut: string;
  depotId?: string;
  livreurId?: string;
  photoUrl?: string;
  [key: string]: any;
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
  reponseClient = '';

  showResponseModal = false;
  showIAModal = false;
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

  // ========== MANIFESTS UI ==========
  showManifestPanel = false;
  selectedManifest: any = null;
  selectedManifestCommandes: Commande[] = [];
  selectedManifestHistory: any[] = [];
  
  manifestFilters = {
    search: '',
    livreurId: '',
    gouvernorat: '',
    minColis: 0,
    dateDebut: '',
    dateFin: ''
  };
  
  selectedManifestIds: Set<string> = new Set();
  bulkDriverId: string = '';
  
  manifestStats: any = {
    totalToday: 0,
    completionRate: 0,
    lateManifests: 0,
    totalColis: 0
  };

  showUserPanel = false;
  selectedUser: UserProfile | null = null;
  selectedUserIds: Set<string> = new Set();
  userSearchFilter = '';
  userRoleFilter = '';
  userStatusFilter = '';

  // Liste des livreurs filtrée depuis les utilisateurs
  get livreursList(): UserProfile[] {
    return this.usersList.filter(user => user.role === 'LIVREUR');
  }

  livraisonsMap: { [orderId: string]: string } = {}; // orderId -> livreurId
  editingGouvernorat: { [livreurId: string]: boolean } = {}; // Pour l'édition inline du gouvernorat
  editingStatus: { [livreurId: string]: boolean } = {}; // Pour l'édition inline du statut

  getAssignedDriverNameForOrder(orderId?: string): string {
    if (!orderId) return '';
    const livreurId = this.livraisonsMap[orderId];
    if (!livreurId) return '';
    const livreur = this.livreurs.find(l => l.id === livreurId);
    return livreur ? `${livreur.prenom} ${livreur.nom}` : 'Livreur inconnu';
  }

  startEditGouvernorat(livreurId: string): void {
    this.editingGouvernorat[livreurId] = true;
  }

  cancelEditGouvernorat(livreurId: string): void {
    this.editingGouvernorat[livreurId] = false;
  }

  startEditStatus(livreurId: string): void {
    this.editingStatus[livreurId] = true;
  }

  cancelEditStatus(livreurId: string): void {
    this.editingStatus[livreurId] = false;
  }

  saveStatus(livreur: Livreur): void {
    if (!livreur.statut) {
      this.showToast('Veuillez choisir un statut', 'error');
      return;
    }

    console.log('=== MISE À JOUR STATUT ===');
    console.log('Livreur ID:', livreur.id);
    console.log('Nouveau statut:', livreur.statut);

    this.apiService.updateLivreurStatut(livreur.id || '', livreur.statut).subscribe({
      next: () => {
        console.log('Succès: Statut mis à jour');
        this.showToast('Statut mis à jour avec succès', 'success');
        this.editingStatus[livreur.id || ''] = false;
        this.refreshData();
      },
      error: (err: any) => {
        console.error('Erreur mise à jour statut:', err);
        console.error('Type:', err?.name);
        console.error('Status:', err?.status);
        console.error('StatusText:', err?.statusText);
        console.error('Message:', err?.message);
        
        let errorMsg = 'Erreur inconnue';
        if (err?.status === 404) {
          errorMsg = 'Livreur non trouvé - créez-le d\'abord';
        } else if (err?.status === 500) {
          errorMsg = 'Erreur serveur';
        } else if (err?.name === 'HttpErrorResponse') {
          errorMsg = 'Erreur de connexion';
        } else if (err?.message) {
          errorMsg = err.message;
        }
        this.showToast('Erreur: ' + errorMsg, 'error');
      }
    });
  }

  saveGouvernorat(livreur: Livreur): void {
    if (!livreur.gouvernorat) {
      this.showToast('Veuillez choisir un gouvernorat', 'error');
      return;
    }

    console.log('=== MISE À JOUR GOUVERNORAT ===');
    console.log('Livreur ID:', livreur.id);
    console.log('Nouveau gouvernorat:', livreur.gouvernorat);
    console.log('Service livreurs URL:', this.apiService['livreursUrl']);

    // Étape 1 : Essayer de mettre à jour le gouvernorat directement
    this.apiService.assignerGouvernoratLivreur(livreur.id || '', livreur.gouvernorat).subscribe({
      next: () => {
        console.log('Succès: Gouvernorat mis à jour via PATCH');
        this.showToast('Gouvernorat mis à jour avec succès', 'success');
        this.editingGouvernorat[livreur.id || ''] = false;
        this.refreshData();
      },
      error: (err: any) => {
        console.error('Erreur PATCH gouvernorat:', err);
        console.error('Status:', err?.status);
        
        // Étape 2 : Si 404, créer le livreur d'abord
        if (err?.status === 404) {
          console.log('Livreur non trouvé (404) - création en cours...');
          const nouveauLivreur: Livreur = {
            id: livreur.id,
            nom: livreur.nom,
            prenom: livreur.prenom,
            email: livreur.email,
            telephone: livreur.telephone,
            gouvernorat: livreur.gouvernorat,
            statut: livreur.statut || 'DISPONIBLE',
            noteMoyenne: livreur.noteMoyenne || 5.0,
            nombreLivraisons: livreur.nombreLivraisons || 0,
            dateInscription: livreur.dateInscription || new Date().toISOString()
          };

          this.apiService.creerLivreur(nouveauLivreur).subscribe({
            next: () => {
              console.log('Succès: Livreur créé dans le service livreurs');
              this.showToast('Livreur créé avec gouvernorat assigné', 'success');
              this.editingGouvernorat[livreur.id || ''] = false;
              this.refreshData();
            },
            error: (creationErr: any) => {
              console.error('Erreur création livreur:', creationErr);
              console.error('Status création:', creationErr?.status);
              
              // Étape 3 : Si création échoue à cause de conflit (409), essayer PUT
              if (creationErr?.status === 409) {
                console.log('Conflit (409) - tentative de mise à jour via PUT');
                this.apiService.updateLivreur(livreur.id || '', { gouvernorat: livreur.gouvernorat }).subscribe({
                  next: () => {
                    console.log('Succès: Livreur mis à jour via PUT');
                    this.showToast('Gouvernorat mis à jour avec succès', 'success');
                    this.editingGouvernorat[livreur.id || ''] = false;
                    this.refreshData();
                  },
                  error: (putErr: any) => {
                    console.error('Erreur PUT:', putErr);
                    this.showToast('Erreur lors de la mise à jour', 'error');
                  }
                });
              } else {
                this.showToast('Erreur lors de la création du livreur', 'error');
              }
            }
          });
        } else {
          let errorMsg = `Erreur HTTP ${err?.status}` || 'Erreur inconnue';
          if (!err?.status && err?.name === 'HttpErrorResponse') {
            errorMsg = 'Erreur de connexion ou CORS';
          }
          console.error('Erreur non gérée:', errorMsg);
          console.error('Type:', err?.name);
          console.error('StatusText:', err?.statusText);
          this.showToast('Erreur: ' + errorMsg, 'error');
        }
      }
    });
  }

  noterLivreur(livreur: Livreur, event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const starWidth = rect.width / 5;
    const note = Math.ceil(clickX / starWidth);
    
    // Mettre à jour localement d'abord pour feedback immédiat
    livreur.noteMoyenne = note;
    
    this.apiService.updateLivreur(livreur.id || '', { noteMoyenne: note }).subscribe({
      next: () => {
        this.showToast(`Note mise à jour: ${note}/5`, 'success');
        this.refreshData();
      },
      error: (err: any) => {
        console.error('Erreur mise à jour note:', err);
        this.showToast('Erreur lors de la mise à jour de la note', 'error');
        // Revenir à l'ancienne note en cas d'erreur
        livreur.noteMoyenne = this.getLivreurNote(livreur);
      }
    });
  }

  showPendingLivreurSidebar = false;
  showLivreursListSidebar = false;
  editingLivreurGouvernorat: { [livreurId: string]: boolean } = {};

  selectedDrivers: { [key: string]: string } = {};
  aiPredictions: { [key: string]: { driverName: string; score: number } } = {};
  assignmentPanelOrderId: string | null = null;

  searchFilter = '';
  private adminMap: any = null;
  private socket: Socket | null = null;
  private trackingServiceUrl = environment.trackingServiceUrl || 'http://localhost:8083';
  private iaServiceUrl = 'http://localhost:8001';
  private driverPositions: any[] = [];
  private depotsPositions: any[] = [];
  mapFilterStatut: string = '';
  mapFilterGouvernorat: string = '';

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
    capaciteKg: 1000,
    type: 'FOURGON'
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
    this.initializeWebSocket();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.disconnectWebSocket();
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

    this.apiService.getAllLivraisons().subscribe({
      next: (res) => {
        const livs = res || [];
        this.livraisonsMap = {};
        livs.forEach(l => {
           if (l.colisId) this.livraisonsMap[l.colisId] = l.livreurId;
           if (l.commandeId) this.livraisonsMap[l.commandeId] = l.livreurId;
        });
      },
      error: (err) => console.error('Error fetching livraisons:', err)
    });

    this.authService.getAllUsers().subscribe({
      next: (res) => {
        this.usersList = res || [];
        this.mergePendingLivreurUsers();
        // Update occupancy after users are loaded in case depots loaded first
        if (this.depots.length > 0) this.updateDepotOccupancy();
      },
      error: (err) => console.error('Error fetching users:', err)
    });

    this.apiService.getAllLivreurs().subscribe({
      next: (res) => {
        console.log('=== DONNÉES LIVREURS DU SERVICE LIVREURS ===');
        console.log('Nombre de livreurs reçus:', res?.length || 0);
        console.log('Livreurs:', res);
        this.livreurs = res || [];
        // this.mergePendingLivreurUsers(); // Désactivé - utilise uniquement les livreurs du service livreurs
        this.computeStats();
      },
      error: (err) => {
        console.error('Error fetching drivers:', err);
        // this.mergePendingLivreurUsers(); // Désactivé - utilise uniquement les livreurs du service livreurs
      }
    });

    this.chargerManifests();
    this.computeManifestStats();

    // Charger les réclamations
    this.apiService.getAllReclamations().subscribe({
      next: (res) => {
        this.reclamations = res || [];
      },
      error: (err) => console.error('Error fetching reclamations:', err)
    });

    // Charger les Dépôts réels depuis le microservice depots-service
    this.apiService.getAllDepots().subscribe({
      next: (res) => {
        this.depots = res || [];
        this.updateDepotOccupancy();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des dépôts:', err);
        this.depots = [];
      }
    });

    // Charger les Véhicules réels depuis le microservice vehicles-service
    this.apiService.getAllVehicules().subscribe({
      next: (res) => {
        this.vehicules = res || [];
      },
      error: (err) => {
        console.error('Erreur lors du chargement des véhicules:', err);
        this.vehicules = [];
      }
    });
  }

  mergePendingLivreurUsers(): void {
    // NE PLUS fusionner automatiquement - afficher SEULEMENT les livreurs du service livreurs
    // Les livreurs sont créés dans le service livreurs lors de la validation
    // Supprimer cette fonction pour éviter les doublons
    console.log('mergePendingLivreurUsers désactivé - livreurs viennent uniquement du service livreurs');
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
    this.loadDepotsFromTracking();
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

      // Utiliser les données réelles du tracking service
      this.updateMapWithRealData();
    }, 200);
  }

  // ========== DEPOTS ==========
  showDepotPanel = false;
  selectedDepot: any = null;
  selectedDepotCommandes: { nouveaux: Commande[], enTransit: Commande[], retours: Commande[], all: Commande[] } = { nouveaux: [], enTransit: [], retours: [], all: [] };

  updateDepotOccupancy(): void {
    if (!this.depots || !this.commandes || !this.usersList) return;

    this.depots.forEach(depot => {
      const stats = this.getDepotStats(depot);
      depot.stats = stats;
      depot.colisActuels = stats.all.length;
    });
  }

  getDepotStats(depot: any): { nouveaux: Commande[], enTransit: Commande[], retours: Commande[], all: Commande[] } {
    // Règle métier : Trouver les commandes dont le gouvernorat correspond à celui du dépôt
    // On simule ici la localisation du client, en cherchant dans l'objet Commande (nomDestinataire, ou fallback)
    // Dans une version plus avancée, la commande aurait directement le gouvernorat de départ.
    const gouvStr = (depot.gouvernorat || depot.ville || '').toLowerCase();
    
    // Pour la démo : on affecte des commandes aléatoirement ou par correspondance de nom si on ne trouve pas
    // Idéalement : c.adresseDepart.gouvernorat === depot.gouvernorat
    let depotCommandes = this.commandes.filter(c => {
       // Mock logic to assign command to depot based on ID hash just to show realistic UI if no gouv is set
       // If client has gouv, use it. Otherwise use a deterministic hash
       const hash = c.id ? c.id.charCodeAt(c.id.length - 1) % this.depots.length : 0;
       const depotIndex = this.depots.indexOf(depot);
       return hash === depotIndex;
    });

    // Filtrage par statuts
    const nouveaux = depotCommandes.filter(c => ['EN_ATTENTE', 'A_ENLEVER', 'AU_DEPOT'].includes(c.statut));
    const enTransit = depotCommandes.filter(c => c.statut === 'EN_LIVRAISON');
    const retours = depotCommandes.filter(c => ['RETOUR_DEPOT', 'RETOUR_EXPEDITEUR'].includes(c.statut));

    return { nouveaux, enTransit, retours, all: depotCommandes };
  }

  getDepotFillPercent(depot: any, type: 'nouveaux' | 'enTransit' | 'retours' | 'all'): number {
    if (!depot.capacite) return 0;
    const stats = depot.stats || this.getDepotStats(depot);
    const count = type === 'all' ? stats.all.length : stats[type].length;
    return Math.min(100, (count / depot.capacite) * 100);
  }

  isDepotOverCapacity(depot: any): boolean {
    return (depot.colisActuels || 0) >= depot.capacite;
  }

  hasDormantStock(depot: any): boolean {
    // Alerte s'il y a plus de 5 retours dans le dépôt
    const stats = depot.stats || this.getDepotStats(depot);
    return stats.retours.length > 5;
  }

  openDepotPanel(depot: any): void {
    this.selectedDepot = depot;
    this.selectedDepotCommandes = depot.stats || this.getDepotStats(depot);
    this.showDepotPanel = true;
  }

  closeDepotPanel(): void {
    this.showDepotPanel = false;
    setTimeout(() => this.selectedDepot = null, 300);
  }

  addDepotAndReset(): void {
    if (!this.nouveauDepot.nom || !this.nouveauDepot.ville) {
      this.showToast('Nom et ville obligatoires', 'error');
      return;
    }

    const depotToSend = {
      nom: this.nouveauDepot.nom,
      ville: this.nouveauDepot.ville,
      gouvernorat: this.nouveauDepot.ville, // On utilise ville comme gouvernorat par défaut
      capacite: this.nouveauDepot.capacite || 500,
      adresse: this.nouveauDepot.ville,
      statut: 'ACTIF'
    };

    this.apiService.creerDepot(depotToSend as any).subscribe({
      next: (res) => {
        this.depots.push(res);
        this.updateDepotOccupancy();
        this.showToast('Dépôt ajouté avec succès', 'success');
        this.nouveauDepot = { nom: '', ville: '', capacite: 500 };
      },
      error: (err) => {
        console.error('Erreur lors de la création du dépôt:', err);
        this.showToast('Erreur création dépôt', 'error');
      }
    });
  }

  removeDepot(id: string): void {
    if (confirm('Voulez-vous vraiment supprimer ce dépôt ?')) {
      this.apiService.deleteDepot(id).subscribe({
        next: () => {
          this.depots = this.depots.filter(d => d.id !== id);
          this.showToast('Dépôt supprimé', 'success');
        },
        error: (err) => {
          console.error('Erreur suppression dépôt:', err);
          this.showToast('Erreur suppression', 'error');
        }
      });
    }
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
      error: (err) => {
        console.error('Erreur approbation utilisateur:', err);
        this.showToast('Erreur lors de l\'approbation de l\'utilisateur', 'error');
      }
    });
  }

  deleteUser(user: UserProfile): void {
    if (!confirm(`Supprimer définitivement ${user.prenom} ${user.nom} ?`)) return;

    console.log('Suppression utilisateur complète - ID:', user.id, 'Role:', user.role);
    
    // Supprimer du service auth
    this.authService.supprimerUtilisateur(user.id).subscribe({
      next: () => {
        console.log('Utilisateur supprimé du service auth');
        
        // Si c'est un livreur, supprimer aussi du service livreurs (silencieusement)
        if (user.role === 'LIVREUR') {
          console.log('C\'est un livreur - tentative suppression du service livreurs');
          this.apiService.deleteLivreur(user.id).subscribe({
            next: () => {
              console.log('Livreur supprimé du service livreurs');
              this.livreurs = this.livreurs.filter(l => l.id !== user.id);
            },
            error: (livreurErr: any) => {
              console.error('Erreur suppression service livreurs (ignorée):', livreurErr?.status);
              // Toujours supprimer de la liste locale, peu importe l'erreur
              this.livreurs = this.livreurs.filter(l => l.id !== user.id);
            }
          });
        }
        
        this.showToast('Utilisateur supprimé', 'success');
        this.refreshData();
      },
      error: (err: any) => {
        console.error('Erreur suppression auth:', err);
        this.showToast('Erreur lors de la suppression de l\'utilisateur', 'error');
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

  // ========== SIDEBAR LISTE D'ATTENTE LIVREURS ==========
  openPendingLivreurSidebar(): void {
    this.showPendingLivreurSidebar = true;
  }

  closePendingLivreurSidebar(): void {
    this.showPendingLivreurSidebar = false;
  }

  openLivreursListSidebar(): void {
    this.showLivreursListSidebar = true;
  }

  closeLivreursListSidebar(): void {
    this.showLivreursListSidebar = false;
  }

  startEditLivreurGouvernorat(livreurId: string): void {
    this.editingLivreurGouvernorat[livreurId] = true;
  }

  cancelEditLivreurGouvernorat(livreurId: string): void {
    this.editingLivreurGouvernorat[livreurId] = false;
  }

  saveLivreurGouvernorat(livreur: Livreur): void {
    if (!livreur.gouvernorat) {
      this.showToast('Veuillez choisir un gouvernorat', 'error');
      return;
    }

    const ancienGouvernorat = livreur.gouvernorat;
    console.log('=== MISE À JOUR GOUVERNORAT LIVREUR ===');
    console.log('Livreur ID:', livreur.id);
    console.log('Livreur:', livreur.prenom, livreur.nom);
    console.log('Ancien gouvernorat:', ancienGouvernorat);
    console.log('Nouveau gouvernorat:', livreur.gouvernorat);

    this.apiService.assignerGouvernoratLivreur(livreur.id || '', livreur.gouvernorat).subscribe({
      next: (response) => {
        console.log('Succès: Gouvernorat mis à jour via PATCH');
        console.log('Réponse API:', response);
        
        // Mettre à jour directement dans usersList
        const userIndex = this.usersList.findIndex(u => u.id === livreur.id);
        console.log('Index utilisateur trouvé:', userIndex);
        if (userIndex >= 0) {
          console.log('Ancien gouvernorat dans usersList:', this.usersList[userIndex].gouvernorat);
          this.usersList[userIndex].gouvernorat = livreur.gouvernorat;
          console.log('Nouveau gouvernorat dans usersList:', this.usersList[userIndex].gouvernorat);
          console.log('Gouvernorat mis à jour localement dans usersList');
          
          // Créer une nouvelle référence pour forcer la détection de changement Angular
          this.usersList = [...this.usersList];
        } else {
          console.error('Utilisateur non trouvé dans usersList avec ID:', livreur.id);
        }
        
        this.editingLivreurGouvernorat[livreur.id || ''] = false;
        this.showToast('Gouvernorat mis à jour avec succès', 'success');
      },
      error: (err: any) => {
        console.error('Erreur PATCH gouvernorat:', err);
        console.error('Status:', err?.status);
        
        // Si 404, créer le livreur d'abord
        if (err?.status === 404) {
          console.log('Livreur non trouvé (404) - création en cours...');
          const nouveauLivreur: Livreur = {
            id: livreur.id,
            nom: livreur.nom,
            prenom: livreur.prenom,
            email: livreur.email,
            telephone: livreur.telephone,
            gouvernorat: livreur.gouvernorat,
            statut: livreur.statut || 'DISPONIBLE',
            noteMoyenne: livreur.noteMoyenne || 5.0,
            nombreLivraisons: livreur.nombreLivraisons || 0,
            dateInscription: livreur.dateInscription || new Date().toISOString()
          };

          this.apiService.creerLivreur(nouveauLivreur).subscribe({
            next: () => {
              console.log('Succès: Livreur créé dans le service livreurs');
              
              // Mettre à jour dans usersList
              const userIndex = this.usersList.findIndex(u => u.id === livreur.id);
              if (userIndex >= 0) {
                this.usersList[userIndex].gouvernorat = livreur.gouvernorat;
                this.usersList = [...this.usersList];
              }
              
              this.showToast('Livreur créé avec gouvernorat assigné', 'success');
              this.editingLivreurGouvernorat[livreur.id || ''] = false;
            },
            error: (creationErr: any) => {
              console.error('Erreur création livreur:', creationErr);
              console.error('Status création:', creationErr?.status);
              
              // Si création échoue à cause de conflit (409), essayer PUT
              if (creationErr?.status === 409) {
                console.log('Conflit (409) - tentative de mise à jour via PUT');
                this.apiService.updateLivreur(livreur.id || '', { gouvernorat: livreur.gouvernorat }).subscribe({
                  next: () => {
                    console.log('Succès: Livreur mis à jour via PUT');
                    
                    // Mettre à jour dans usersList
                    const userIndex = this.usersList.findIndex(u => u.id === livreur.id);
                    if (userIndex >= 0) {
                      this.usersList[userIndex].gouvernorat = livreur.gouvernorat;
                      this.usersList = [...this.usersList];
                    }
                    
                    this.showToast('Gouvernorat mis à jour avec succès', 'success');
                    this.editingLivreurGouvernorat[livreur.id || ''] = false;
                  },
                  error: (putErr: any) => {
                    console.error('Erreur PUT:', putErr);
                    this.showToast('Erreur lors de la mise à jour', 'error');
                  }
                });
              } else {
                this.showToast('Erreur lors de la création du livreur', 'error');
              }
            }
          });
        } else {
          let errorMsg = `Erreur HTTP ${err?.status}` || 'Erreur inconnue';
          if (!err?.status && err?.name === 'HttpErrorResponse') {
            errorMsg = 'Erreur de connexion ou CORS';
          }
          console.error('Erreur non gérée:', errorMsg);
          console.error('Type:', err?.name);
          console.error('StatusText:', err?.statusText);
          this.showToast('Erreur: ' + errorMsg, 'error');
        }
      }
    });
  }

  openAddLivreurModal(): void {
    // Utiliser le formulaire existant pour ajouter un livreur
    this.activeTab = 'inscriptions';
    this.showToast('Formulaire d\'ajout de livreur à implémenter', 'info');
  }

  openAddClientModal(): void {
    // Utiliser le formulaire existant pour ajouter un client
    this.activeTab = 'inscriptions';
    this.showToast('Formulaire d\'ajout de client à implémenter', 'info');
  }

  getUserRole(user: UserProfile): string {
    return user.role || 'CLIENT';
  }

  get filteredUsersList(): UserProfile[] {
    let result = this.usersList;
    if (this.userRoleFilter) {
      result = result.filter(u => u.role === this.userRoleFilter);
    }
    if (this.userStatusFilter) {
      result = result.filter(u => u.statut === this.userStatusFilter);
    }
    if (this.userSearchFilter.trim()) {
      const q = this.userSearchFilter.toLowerCase();
      result = result.filter(u => 
        u.nom?.toLowerCase().includes(q) || 
        u.prenom?.toLowerCase().includes(q) || 
        u.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }

  toggleUserSelection(userId: string): void {
    if (this.selectedUserIds.has(userId)) {
      this.selectedUserIds.delete(userId);
    } else {
      this.selectedUserIds.add(userId);
    }
  }

  selectAllUsers(users: any[]): void {
    if (this.selectedUserIds.size === users.length) {
      this.selectedUserIds.clear();
    } else {
      users.forEach(u => this.selectedUserIds.add(u.id));
    }
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUserIds.has(userId);
  }

  bulkApprove(): void {
    const ids = Array.from(this.selectedUserIds);
    if (ids.length === 0) return;
    if (!confirm(`Approuver ${ids.length} utilisateurs ?`)) return;

    console.log('=== APPROBATION EN MASSE ===');
    console.log('IDs à approuver:', ids);

    this.authService.bulkApprouverUtilisateurs(ids).subscribe({
      next: () => {
        console.log('Succès: Utilisateurs approuvés');
        this.showToast(`${ids.length} utilisateurs approuvés`, 'success');
        this.selectedUserIds.clear();
        this.refreshData();
      },
      error: (err: any) => {
        console.error('Erreur approbation en masse:', err);
        console.error('Type:', err?.name);
        console.error('Status:', err?.status);
        console.error('StatusText:', err?.statusText);
        console.error('Message:', err?.message);
        
        let errorMsg = 'Erreur inconnue';
        if (err?.status === 500) {
          errorMsg = 'Erreur serveur';
        } else if (err?.name === 'HttpErrorResponse') {
          errorMsg = 'Erreur de connexion';
        } else if (err?.message) {
          errorMsg = err.message;
        }
        this.showToast('Erreur: ' + errorMsg, 'error');
      }
    });
  }

  bulkSuspend(): void {
    const ids = Array.from(this.selectedUserIds);
    if (ids.length === 0) return;
    if (!confirm(`Suspendre ${ids.length} utilisateurs ?`)) return;

    this.authService.bulkChangerStatut(ids, 'SUSPENDU').subscribe({
      next: () => {
        this.showToast(`${ids.length} utilisateurs suspendus`, 'success');
        this.selectedUserIds.clear();
        this.refreshData();
      },
      error: () => this.showToast('Erreur lors de la suspension en masse', 'error')
    });
  }

  getAvatarInitials(user: any): string {
    const first = user.prenom ? user.prenom.charAt(0).toUpperCase() : '';
    const last = user.nom ? user.nom.charAt(0).toUpperCase() : '';
    return (first + last) || 'U';
  }

  getAvatarColor(userId: string): string {
    if (!userId) return '#3b82f6';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // ========== COMMANDES / DISPATCH ==========
  isOrderPending(order: Commande): boolean {
    // Une commande est en attente de dispatch si elle n'a pas encore de livreur affecté
    const hasLivreur = this.livraisonsMap[order.id || ''];
    const isWaitingStatut = ['EN_ATTENTE', 'MANIFESTE', 'A_ENLEVER'].includes(order.statut || 'EN_ATTENTE');
    return isWaitingStatut && !hasLivreur;
  }

  assignDriverManually(order: Commande): void {
    const driverId = this.selectedDrivers[order.id || ''];
    if (!driverId) {
      this.showToast('Veuillez sélectionner un livreur', 'error');
      return;
    }

    const orderId = order.id || '';
    console.log('Affectation manuelle - Commande:', orderId, 'Livreur:', driverId);
    
    // Flux simplifié : seulement créer la livraison, le backend gérera les statuts
    this.apiService.creerLivraison(orderId, driverId).subscribe({
      next: () => {
        console.log('Livraison créée avec succès');
        // Mettre à jour la carte des livraisons pour afficher le livreur affecté
        this.livraisonsMap[orderId] = driverId;
        // Marquer la commande comme dispatchée
        this.apiService.markCommandeAsDispatched(orderId).subscribe({
          next: () => {
            this.showToast('Livreur affecté avec succès', 'success');
            this.refreshData();
          },
          error: (err) => {
            console.error('Erreur marquage commande dispatchée:', err);
            this.showToast('Livreur affecté (marquage dispatchée échoué)', 'info');
            this.refreshData();
          }
        });
      },
      error: (err: any) => {
        console.error('Erreur création livraison:', err);
        this.showToast('Erreur d\'affectation: ' + (err?.message || 'Erreur inconnue'), 'error');
      }
    });
  }

  assignDriverAI(order: Commande): void {
    const orderId = order.id || '';
    if (!orderId) return;

    // Utiliser les livreurs du service auth au lieu du service livreurs
    const availableDrivers = this.getLivreurUsers().filter(l => l.statut === 'DISPONIBLE' || l.statut === 'ACTIF');
    if (availableDrivers.length === 0) {
      this.showToast('Aucun livreur disponible. Approuvez des livreurs d\'abord.', 'error');
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

  dispatchGlobalIA(): void {
    // Filtrer uniquement les commandes non dispatchées et en attente
    const pendingOrders = this.commandes.filter(c => 
      c.statut === 'A_ENLEVER' && 
      (c.dispatched === false || c.dispatched === undefined)
    );
    
    if (pendingOrders.length === 0) {
      this.showToast('Aucune nouvelle commande à dispatcher (toutes les commandes ont déjà été dispatchées).', 'info');
      return;
    }
    // Utiliser les livreurs du service auth
    const availableDrivers = this.getLivreurUsers().filter(l => l.statut === 'DISPONIBLE' || l.statut === 'ACTIF');
    if (availableDrivers.length === 0) {
      this.showToast('Aucun livreur disponible. Approuvez des livreurs d\'abord.', 'error');
      return;
    }

    this.showToast('Algorithme de Clustering IA en cours...', 'info');
    
    console.log('Commandes à dispatcher:', pendingOrders.length);
    console.log('Livreurs disponibles:', availableDrivers.length);
    console.log('URL IA:', this.iaServiceUrl);
    
    this.apiService.dispatchGlobal(pendingOrders, availableDrivers).subscribe({
      next: (res: any) => {
        console.log('Réponse IA dispatch:', res);
        const affectations = res.affectations;
        let count = 0;
        let totalAssigned = 0;
        
        for (const [livreurId, orderIds] of Object.entries(affectations)) {
          const listIds = orderIds as string[];
          totalAssigned += listIds.length;
          
          for (const orderId of listIds) {
            this.apiService.creerLivraison(orderId, livreurId).subscribe({
              next: () => {
                // Mettre à jour la carte des livraisons pour afficher le livreur affecté
                this.livraisonsMap[orderId] = livreurId;
                
                this.apiService.updateCommandeStatut(orderId, 'EN_LIVRAISON').subscribe({
                  next: () => {
                    this.apiService.updateLivreurStatut(livreurId, 'EN_COURSE').subscribe({
                      next: () => {
                        // Marquer la commande comme dispatchée
                        this.apiService.markCommandeAsDispatched(orderId).subscribe({
                          next: () => {
                            count++;
                            if (count === totalAssigned) {
                               this.showToast(`Dispatch terminé ! ${totalAssigned} commandes affectées (Clustering K-Means).`, 'success');
                               this.refreshData();
                            }
                          },
                          error: (err) => console.error('Erreur marquage commande dispatchée:', err)
                        });
                      },
                      error: (err) => console.error('Erreur mise à jour statut livreur:', err)
                    });
                  },
                  error: (err) => console.error('Erreur mise à jour statut commande:', err)
                });
              },
              error: (err) => console.error('Erreur création livraison:', err)
            });
          }
        }
        
        if (totalAssigned === 0) {
            this.showToast('L\'IA n\'a pu assigner aucune commande.', 'info');
        }
      },
      error: (err: any) => {
        console.error('Erreur IA Dispatch complète:', err);
        console.error('Type erreur:', err?.name);
        console.error('Status:', err?.status);
        console.error('StatusText:', err?.statusText);
        console.error('Message:', err?.message);
        console.error('URL:', err?.url);
        console.error('Error object:', JSON.stringify(err?.error));
        console.error('Stack:', err?.stack);
        
        let errorMsg = err?.message || 'Erreur inconnue';
        if (err?.status) {
          errorMsg = `Erreur HTTP ${err.status}: ${errorMsg}`;
        } else if (err?.name === 'HttpErrorResponse') {
          errorMsg = 'Erreur de connexion au service IA';
        }
        
        this.showToast('Erreur IA Dispatch : ' + errorMsg, 'error');
      }
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
      error: (err) => {
        console.error('Erreur création livreur:', err);
        this.showToast('Erreur lors de la création du livreur', 'error');
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
      error: (err: any) => {
        console.error('Erreur validation livreur complète:', err);
        console.error('Status:', err?.status);
        console.error('Status Text:', err?.statusText);
        console.error('Message:', err?.message);
        console.error('Error object:', err?.error);
        console.error('URL appelée:', `${this.apiService['livreursUrl']}/livreurs/${livreurId}/statut`);
        
        let errorMessage = 'Erreur inconnue';
        if (err?.status === 500) {
          errorMessage = 'Erreur serveur 500 - Contactez l\'administrateur';
          console.error('Détails erreur serveur:', JSON.stringify(err?.error));
        } else if (err?.status) {
          errorMessage = `Erreur HTTP ${err.status}`;
        } else if (err?.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        
        this.showToast(`Erreur: ${errorMessage}`, 'error');
      }
    });
  }

  affecterGouvernoratEtValider(livreur: Livreur): void {
    if (!livreur.gouvernorat) {
      this.showToast('Choisissez un gouvernorat', 'error');
      return;
    }

    console.log('Tentative de validation pour livreur:', livreur.id);
    console.log('URL service livreurs:', this.apiService['livreursUrl']);

    // Créer ou mettre à jour le livreur avec le gouvernorat
    const livreurPayload: Livreur = {
      id: livreur.id,
      nom: livreur.nom,
      prenom: livreur.prenom,
      email: livreur.email,
      telephone: livreur.telephone,
      gouvernorat: livreur.gouvernorat,
      statut: 'DISPONIBLE',
      noteMoyenne: 5.0,
      nombreLivraisons: 0,
      dateInscription: new Date().toISOString()
    };

    this.apiService.creerLivreur(livreurPayload).subscribe({
      next: (createdLivreur) => {
        console.log('Livreur créé/mis à jour avec succès:', createdLivreur);
        this.showToast('Livreur validé avec succès', 'success');
        this.refreshData();
      },
      error: (err: any) => {
        console.error('Erreur création/mise à jour livreur:', err);
        console.error('Status:', err?.status);
        console.error('Message:', err?.message);
        console.error('Error details:', JSON.stringify(err?.error));
        
        let errorMsg = 'Erreur inconnue';
        if (err?.status === 409) {
          errorMsg = 'Livreur existe déjà - mise à jour en cours';
          // Si conflit (livreur existe), essayer de mettre à jour le gouvernorat via PATCH
          this.apiService.assignerGouvernoratLivreur(livreur.id, livreur.gouvernorat).subscribe({
            next: () => {
              // Puis mettre à jour le statut
              this.apiService.updateLivreurStatut(livreur.id, 'DISPONIBLE').subscribe({
                next: () => {
                  this.showToast('Livreur mis à jour avec succès', 'success');
                  this.refreshData();
                },
                error: (statutErr: any) => {
                  console.error('Erreur mise à jour statut:', statutErr);
                  this.showToast('Livreur mis à jour (statut non changé)', 'info');
                  this.refreshData();
                }
              });
            },
            error: (updateErr: any) => {
              console.error('Erreur mise à jour gouvernorat:', updateErr);
              this.showToast(`Erreur mise à jour: ${updateErr?.status || 'inconnue'}`, 'error');
            }
          });
        } else if (err?.status) {
          errorMsg = `Erreur HTTP ${err.status}`;
        } else if (err?.message) {
          errorMsg = err.message;
        }
        
        if (err?.status !== 409) {
          this.showToast(`Erreur: ${errorMsg}`, 'error');
        }
      }
    });
  }

  affecterGouvernorat(livreurId: string, gouvernorat: string): void {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (!livreur) return;

    this.apiService.updateLivreur(livreurId, { gouvernorat }).subscribe({
      next: () => {
        livreur.gouvernorat = gouvernorat;
        this.showToast(`Affecté à ${gouvernorat}`, 'success');
      },
      error: (err) => {
        console.error('Erreur affectation gouvernorat:', err);
        this.showToast('Erreur lors de l\'affectation du gouvernorat', 'error');
      }
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
      error: (err) => {
        console.error('Erreur suspension livreur:', err);
        this.showToast('Erreur lors de la suspension du livreur', 'error');
      }
    });
  }

  reactiverLivreur(livreurId: string): void {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (!livreur) return;

    this.apiService.updateLivreurStatut(livreurId, 'DISPONIBLE').subscribe({
      next: () => {
        livreur.statut = 'DISPONIBLE';
        this.showToast('Livreur réactivé', 'success');
        this.refreshData();
      },
      error: (err) => {
        console.error('Erreur réactivation livreur:', err);
        this.showToast('Erreur lors de la réactivation du livreur', 'error');
      }
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
    console.log('=== SUPPRESSION LIVREUR APPELÉE ===');
    console.log('Livreur ID reçu:', lId);
    console.log('Type de lId:', typeof lId);
    console.log('lId est vide?', !lId);
    
    // Si l'ID est vide, chercher par email
    if (!lId) {
      console.error('ID vide - impossible de supprimer');
      this.showToast('Erreur: ID du livreur manquant', 'error');
      return;
    }
    
    const l = this.livreurs.find(liv => liv.id === lId || liv.email === lId);
    if (!l) {
      console.error('Livreur non trouvé dans la liste locale');
      console.log('Liste des livreurs:', this.livreurs.map(liv => ({ id: liv.id, email: liv.email, nom: liv.nom })));
      return;
    }
    
    console.log('Livreur trouvé:', l.prenom, l.nom, 'ID:', l.id, 'Email:', l.email);
    
    if (!confirm(`Supprimer définitivement le livreur ${l.prenom} ${l.nom} ?\n\nCette action le supprimera du système entier (livreurs + auth).`)) {
      console.log('Suppression annulée par l\'utilisateur');
      return;
    }

    console.log('Suppression complète du livreur:', lId);

    // Supprimer du service livreurs
    this.apiService.deleteLivreur(lId).subscribe({
      next: () => {
        console.log('Livreur supprimé du service livreurs');
        
        // Supprimer aussi du service auth
        this.authService.supprimerUtilisateur(lId).subscribe({
          next: () => {
            console.log('Livreur supprimé du service auth');
            this.showToast('Livreur supprimé définitivement', 'success');
            this.refreshData();
          },
          error: (authErr: any) => {
            console.error('Erreur suppression service auth:', authErr);
            console.error('Status auth:', authErr?.status);
            
            // Si suppression auth échoue, on continue quand même (livreur déjà supprimé de livreurs)
            if (authErr?.status === 404) {
              console.log('Livreur non trouvé dans service auth - OK (déjà supprimé)');
              this.showToast('Livreur supprimé (auth non trouvé)', 'info');
              this.refreshData();
            } else {
              let errorMsg = 'Erreur inconnue';
              if (authErr?.status === 500) {
                errorMsg = 'Erreur serveur auth';
              } else if (authErr?.message) {
                errorMsg = authErr.message;
              }
              this.showToast('Livreur supprimé (erreur auth): ' + errorMsg, 'info');
              this.refreshData();
            }
          }
        });
      },
      error: (livreurErr: any) => {
        console.error('=== ERREUR SUPPRESSION LIVREUR COMPLÈTE ===');
        console.error('Livreur ID:', lId);
        console.error('Erreur service livreurs:', livreurErr);
        console.error('Type:', livreurErr?.name);
        console.error('Status:', livreurErr?.status);
        console.error('StatusText:', livreurErr?.statusText);
        console.error('Message:', livreurErr?.message);
        console.error('URL:', livreurErr?.url);
        console.error('Error object:', JSON.stringify(livreurErr?.error));
        
        // Si suppression livreurs échoue avec 404 (déjà supprimé de la base), supprimer localement
        if (livreurErr?.status === 404) {
          console.log('Livreur non trouvé dans livreurs (déjà supprimé de la base) - suppression locale uniquement');
          this.livreurs = this.livreurs.filter(liv => liv.id !== lId);
          this.showToast('Livreur supprimé de la liste (déjà supprimé de la base)', 'success');
          
          // Essayer quand même de supprimer du service auth
          this.authService.supprimerUtilisateur(lId).subscribe({
            next: () => {
              console.log('Livreur supprimé du service auth');
            },
            error: (authErr: any) => {
              console.error('Erreur suppression auth:', authErr);
              // Ignorer l'erreur auth car le livreur est déjà supprimé localement
            }
          });
        } else {
          let errorMsg = 'Erreur inconnue';
          if (livreurErr?.status === 500) {
            errorMsg = 'Erreur serveur livreurs';
          } else if (livreurErr?.name === 'HttpErrorResponse') {
            errorMsg = 'Erreur de connexion';
          } else if (livreurErr?.message) {
            errorMsg = livreurErr.message;
          }
          this.showToast('Erreur: ' + errorMsg, 'error');
        }
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

  getPendingRegistrations(): any[] {
    return this.usersList.filter(u => u.role === 'LIVREUR' && (!u.approuve || u.statut === 'INSCRIPTION'));
  }

  getLivreurUsers(): any[] {
    // Retourne SEULEMENT les livreurs approuvés du service auth
    return this.usersList.filter(u => u.role === 'LIVREUR' && u.approuve && u.statut !== 'INSCRIPTION');
  }

  getAvailableDrivers(): any[] {
    // Utiliser les livreurs approuvés du service auth
    return this.getLivreurUsers().filter(l => l.statut === 'DISPONIBLE');
  }

  getActiveDriversCount(): number {
    // Utiliser les livreurs approuvés du service auth
    // Inclut DISPONIBLE, EN_COURSE, ACTIF, et tout statut actif
    return this.getLivreurUsers().filter(l =>
      l.statut === 'DISPONIBLE' ||
      l.statut === 'EN_COURSE' ||
      l.statut === 'ACTIF' ||
      (!l.statut || l.statut !== 'INSCRIPTION' && l.statut !== 'SUSPENDU')
    ).length;
  }

  getAvailableDriversCount(): number {
    // Utiliser les livreurs approuvés du service auth
    // Livreurs disponibles pour prendre des commandes
    return this.getLivreurUsers().filter(l =>
      l.statut === 'DISPONIBLE' ||
      l.statut === 'ACTIF' ||
      (!l.statut || l.statut !== 'INSCRIPTION' && l.statut !== 'SUSPENDU' && l.statut !== 'EN_COURSE')
    ).length;
  }

  getLivreurGouvernorat(livreur: Livreur): string {
    return livreur.gouvernorat || 'Non assigné';
  }

  getLivreurNote(livreur: Livreur): number {
    return livreur.noteMoyenne ?? 5.0;
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
        this.computeManifestStats();
        console.log('📋 Manifestes chargés (mise à jour temps réel):', this.manifests.length);
      },
      error: (err) => {
        console.error('Erreur chargement manifestes:', err);
        this.manifests = [];
        this.computeManifestStats();
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
      error: (err) => {
        console.error('Erreur affectation manifeste:', err);
        this.showToast('Erreur lors de l\'affectation du manifeste', 'error');
      }
    });
  }

  validerRetraitManifest(manifestId: string): void {
    const manifest = this.manifests.find(m => m.id === manifestId);
    if (!manifest) return;

    this.apiService.updateManifeste(manifestId, manifest).subscribe({
      next: () => {
        manifest.statut = 'EN_LIVRAISON';
        this.showToast('Retrait validé — en livraison', 'success');
        this.refreshData();
      },
      error: (err) => {
        console.error('Erreur validation retrait manifeste:', err);
        this.showToast('Erreur lors de la validation du retrait', 'error');
      }
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

  getClientNameForManifest(clientId: string): string {
    const client = this.usersList.find(u => u.id === clientId);
    return client ? `${client.prenom} ${client.nom}` : 'Inconnu';
  }

  getManifestMontant(manifest: any): number {
    const commandes = this.getManifestCommandes(manifest);
    return commandes.reduce((total, cmd) => total + (cmd.montantTotal || 0), 0);
  }

  // ========== MANIFESTS DETAIL PANEL ==========
  openManifestPanel(manifest: any): void {
    this.selectedManifest = manifest;
    this.selectedManifestCommandes = this.getManifestCommandes(manifest);
    this.selectedManifestHistory = this.getManifestHistory(manifest);
    this.showManifestPanel = true;
  }

  closeManifestPanel(): void {
    this.showManifestPanel = false;
    setTimeout(() => {
      this.selectedManifest = null;
      this.selectedManifestCommandes = [];
      this.selectedManifestHistory = [];
    }, 300);
  }

  getManifestCommandes(manifest: any): Commande[] {
    if (!manifest || !manifest.commandeIds) return [];
    return this.commandes.filter(c => manifest.commandeIds.includes(c.id));
  }

  getManifestHistory(manifest: any): any[] {
    // Simuler un historique - dans une vraie app, cela viendrait du backend
    const history = [
      {
        date: manifest.dateCreation,
        action: 'Création',
        utilisateur: 'Système',
        details: 'Manifeste créé automatiquement'
      }
    ];

    if (manifest.livreurId) {
      const driver = this.livreurs.find(l => l.id === manifest.livreurId);
      history.push({
        date: manifest.dateAffectation || new Date().toISOString(),
        action: 'Affectation',
        utilisateur: 'Admin',
        details: `Affecté à ${driver ? `${driver.prenom} ${driver.nom}` : 'Livreur inconnu'}`
      });
    }

    if (manifest.statut === 'EN_LIVRAISON') {
      history.push({
        date: manifest.dateRetrait || new Date().toISOString(),
        action: 'Retrait validé',
        utilisateur: 'Admin',
        details: 'Retrait du dépôt validé'
      });
    }

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getAssignedDriver(manifest: any): Livreur | null {
    if (!manifest.livreurId) return null;
    return this.livreurs.find(l => l.id === manifest.livreurId) || null;
  }

  getDriverVehicle(manifest: any): Vehicule | null {
    const driver = this.getAssignedDriver(manifest);
    if (!driver) return null;
    return this.vehicules.find(v => v.livreurId === driver.id) || null;
  }

  // ========== MANIFESTS FILTERS ==========
  get filteredManifests(): any[] {
    let result = this.manifests;

    // Filtre par recherche
    if (this.manifestFilters.search.trim()) {
      const q = this.manifestFilters.search.toLowerCase();
      result = result.filter(m => 
        (m.id && m.id.toLowerCase().includes(q)) ||
        (m.clientId && this.getClientNameForManifest(m.clientId).toLowerCase().includes(q))
      );
    }

    // Filtre par livreur
    if (this.manifestFilters.livreurId) {
      result = result.filter(m => m.livreurId === this.manifestFilters.livreurId);
    }

    // Filtre par nombre de colis minimum
    if (this.manifestFilters.minColis > 0) {
      result = result.filter(m => this.getManifestColisCount(m) >= this.manifestFilters.minColis);
    }

    // Filtre par date
    if (this.manifestFilters.dateDebut) {
      result = result.filter(m => new Date(m.dateCreation) >= new Date(this.manifestFilters.dateDebut));
    }
    if (this.manifestFilters.dateFin) {
      result = result.filter(m => new Date(m.dateCreation) <= new Date(this.manifestFilters.dateFin));
    }

    return result;
  }

  resetManifestFilters(): void {
    this.manifestFilters = {
      search: '',
      livreurId: '',
      gouvernorat: '',
      minColis: 0,
      dateDebut: '',
      dateFin: ''
    };
  }

  // ========== MANIFESTS KPIs ==========
  computeManifestStats(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.manifestStats.totalToday = this.manifests.filter(m => 
      new Date(m.dateCreation) >= today
    ).length;

    const completed = this.manifests.filter(m => 
      m.statut === 'LIVRE' || m.statut === 'LIVRE_PAYE'
    ).length;
    this.manifestStats.completionRate = this.manifests.length > 0 
      ? Math.round((completed / this.manifests.length) * 100) 
      : 0;

    // Manifestes en retard (plus de 24h sans retrait pour ceux en A_ENLEVER)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    this.manifestStats.lateManifests = this.manifests.filter(m => 
      m.statut === 'A_ENLEVER' && new Date(m.dateAffectation || m.dateCreation) < yesterday
    ).length;

    this.manifestStats.totalColis = this.manifests.reduce((sum, m) => 
      sum + this.getManifestColisCount(m), 0
    );
  }

  // ========== MANIFESTS BULK ACTIONS ==========
  toggleManifestSelection(manifestId: string): void {
    if (this.selectedManifestIds.has(manifestId)) {
      this.selectedManifestIds.delete(manifestId);
    } else {
      this.selectedManifestIds.add(manifestId);
    }
  }

  selectAllManifests(manifests: any[]): void {
    if (this.selectedManifestIds.size === manifests.length) {
      this.selectedManifestIds.clear();
    } else {
      manifests.forEach(m => this.selectedManifestIds.add(m.id));
    }
  }

  isManifestSelected(manifestId: string): boolean {
    return this.selectedManifestIds.has(manifestId);
  }

  bulkAssignDriver(): void {
    if (!this.bulkDriverId) {
      this.showToast('Sélectionnez un livreur', 'error');
      return;
    }

    if (this.selectedManifestIds.size === 0) {
      this.showToast('Sélectionnez au moins un manifeste', 'error');
      return;
    }

    const livreur = this.livreurs.find(l => l.id === this.bulkDriverId);
    if (!livreur) return;

    let successCount = 0;
    this.selectedManifestIds.forEach(manifestId => {
      const manifest = this.manifests.find(m => m.id === manifestId);
      if (manifest) {
        manifest.livreurId = this.bulkDriverId;
        manifest.statut = 'A_ENLEVER';
        this.apiService.updateManifeste(manifestId, manifest).subscribe({
          next: () => successCount++,
          error: () => {}
        });
      }
    });

    this.showToast(`${successCount} manifeste(s) affecté(s) à ${livreur.prenom} ${livreur.nom}`, 'success');
    this.selectedManifestIds.clear();
    this.bulkDriverId = '';
    this.refreshData();
  }

  bulkCancel(): void {
    if (this.selectedManifestIds.size === 0) {
      this.showToast('Sélectionnez au moins un manifeste', 'error');
      return;
    }

    if (!confirm(`Annuler ${this.selectedManifestIds.size} manifeste(s) ?`)) return;

    let successCount = 0;
    this.selectedManifestIds.forEach(manifestId => {
      const manifest = this.manifests.find(m => m.id === manifestId);
      if (manifest && manifest.statut === 'A_ENLEVER') {
        manifest.livreurId = null;
        manifest.statut = 'VALIDE';
        this.apiService.updateManifeste(manifestId, manifest).subscribe({
          next: () => successCount++,
          error: () => {}
        });
      }
    });

    this.showToast(`${successCount} manifeste(s) annulé(s)`, 'success');
    this.selectedManifestIds.clear();
    this.refreshData();
  }

  bulkExport(): void {
    if (this.selectedManifestIds.size === 0) {
      this.showToast('Sélectionnez au moins un manifeste', 'error');
      return;
    }

    // Créer un CSV simple
    const selectedManifests = this.manifests.filter(m => this.selectedManifestIds.has(m.id));
    let csv = 'ID,Date,Statut,Livreur,Nombre de colis\n';
    
    selectedManifests.forEach(m => {
      const driverName = this.getDriverNameForManifest(m.livreurId || '');
      csv += `${m.id},${this.formatDate(m.dateCreation)},${m.statut},${driverName},${this.getManifestColisCount(m)}\n`;
    });

    // Télécharger le fichier
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manifestes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    this.showToast('Export CSV généré', 'success');
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

    // Utiliser les livreurs approuvés du service auth pour les statistiques
    const approvedDrivers = this.getLivreurUsers();
    const notes = approvedDrivers
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

  formatDateTime(dateString: string): string {
    return this.formatDate(dateString);
  }

  getDaysSince(dateString?: string): number {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
    console.log('🔍 Début analyse IA - Réclamations:', this.reclamations.length);
    this.showToast('Analyse IA en cours...', 'info');
    
    // Appel réel au service IA
    this.apiService.detecterAnomaliesReclamations(this.reclamations, 7).subscribe({
      next: (response) => {
        console.log('🔍 Réponse IA reçue:', response);
        this.anomaliesDetectees = response.anomalies || [];
        this.classifierReclamations();
        
        // Ouvrir le modal avec les résultats
        this.showIAModal = true;
        
        if (this.anomaliesDetectees.length === 0) {
          this.showToast('Aucune anomalie détectée', 'info');
        } else {
          this.showToast(`${this.anomaliesDetectees.length} anomalie(s) détectée(s)`, 'success');
        }
      },
      error: (err) => {
        console.error('Erreur IA anomalies:', err);
        // Fallback vers détection locale
        this.detecterAnomalies();
        this.classifierReclamations();
        
        // Ouvrir le modal avec les résultats locaux
        this.showIAModal = true;
        
        this.showToast('Analyse locale activée (service IA indisponible)', 'info');
      }
    });
  }

  getCurrentDateTime(): string {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  closeIAModal(): void {
    this.showIAModal = false;
  }

  detecterAnomalies(): void {
    // Analyse locale améliorée avec règles avancées
    this.anomaliesDetectees = [];
    
    const recentReclamations = this.reclamations.filter(rec => 
      this.getDaysSince(rec.dateCreation) <= 1
    );
    
    // 1. Pic de réclamations (>5 dans les 24h)
    if (recentReclamations.length > 5) {
      this.anomaliesDetectees.push({
        type: 'SPIKE_RECLAMATIONS',
        niveau: 'HAUT',
        description: `Pic de réclamations: ${recentReclamations.length} aujourd'hui`,
        actionRecommandee: 'Investiguer la cause du pic (incident technique ?)'
      });
    }
    
    // 2. Clients irrités (>2 réclamations récentes)
    const clientCounts = this.getClientReclamationCounts();
    const irriteClients = clientCounts.filter(c => c.count > 2);
    
    if (irriteClients.length > 0) {
      const topClient = irriteClients.sort((a, b) => b.count - a.count)[0];
      this.anomaliesDetectees.push({
        type: 'CLIENT_IRRITE',
        niveau: 'MOYEN',
        description: `${irriteClients.length} clients avec >2 réclamations (max: ${topClient.count})`,
        actionRecommandee: `Contacter prioritairement le client ${topClient.clientId}`
      });
    }
    
    // 3. Problèmes récurrents (>3 fois le même type)
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
    
    // 4. Réclamations urgentes en attente
    const urgentPending = this.reclamations.filter(rec => 
      rec.statut === 'EN_ATTENTE' && 
      this.getDaysSince(rec.dateCreation) > 2
    );
    
    if (urgentPending.length > 0) {
      this.anomaliesDetectees.push({
        type: 'RECLAMATIONS_URGENTES',
        niveau: 'HAUT',
        description: `${urgentPending.length} réclamations urgentes en attente (>2 jours)`,
        actionRecommandee: 'Traiter prioritairement les réclamations en attente'
      });
    }
    
    // 5. Taux de résolution faible
    const resolved = this.reclamations.filter(r => r.statut === 'RESOLUE').length;
    const total = this.reclamations.length;
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;
    
    if (total > 10 && resolutionRate < 50) {
      this.anomaliesDetectees.push({
        type: 'TAUX_RESOLUTION_FAIBLE',
        niveau: 'MOYEN',
        description: `Taux de résolution faible: ${resolutionRate.toFixed(1)}%`,
        actionRecommandee: 'Améliorer le processus de traitement des réclamations'
      });
    }
  }

  classifierReclamations(): void {
    // Analyser chaque réclamation avec l'analyse locale
    this.reclamations.forEach(rec => {
      if (!this.reclamationsAnalysis[rec.id]) {
        this.reclamationsAnalysis[rec.id] = this.analyserReclamationRuleBased(rec);
      }
    });
  }

  analyserReclamationIA(reclamation: any): void {
    // Utiliser directement l'analyse locale (sans appel API)
    this.reclamationsAnalysis[reclamation.id] = this.analyserReclamationRuleBased(reclamation);
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
  
  voirDetailReclamation(reclamation: any): void {
    this.selectedReclamation = reclamation;
    this.selectedReclamationAnalysis = this.reclamationsAnalysis[reclamation.id] || this.analyserReclamationIA(reclamation);
    this.reponseClient = reclamation.reponseAdmin || '';
    this.showReclamationDetail = true;
  }

  closeReclamationDetail(): void {
    this.showReclamationDetail = false;
    this.selectedReclamation = null;
    this.selectedReclamationAnalysis = null;
    this.reponseClient = '';
  }

  // ========== RÉPONSE IA ==========

  genererReponseIA(reclamation: any): void {
    this.selectedReclamation = reclamation;
    this.showReclamationDetail = false; // Fermer le panneau de détails
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

    const payload = {
      ...this.selectedReclamation,
      reponseAdmin: this.responseText,  // Réponse visible par le client
      statut: 'EN_COURS',
      dateReponse: new Date().toISOString()
    };

    console.log('📤 Envoi de la réponse IA:', payload);

    this.apiService.updateReclamation(this.selectedReclamation.id, payload).subscribe({
      next: (response) => {
        console.log('✅ Réponse IA envoyée avec succès:', response);
        this.showToast('Réponse envoyée au client avec succès', 'success');
        this.refreshData();
        this.closeResponseModal();
      },
      error: (err) => {
        console.error('❌ Erreur envoi réponse:', err);
        this.showToast('Erreur lors de l\'envoi de la réponse', 'error');
      }
    });
  }

  envoyerReponseClient(): void {
    if (!this.selectedReclamation || !this.reponseClient.trim()) return;

    const payload = {
      ...this.selectedReclamation,
      reponseAdmin: this.reponseClient,
      statut: 'EN_COURS',
      dateReponse: new Date().toISOString()
    };

    this.apiService.updateReclamation(this.selectedReclamation.id, payload).subscribe({
      next: () => {
        this.showToast('Réponse envoyée au client', 'success');
        this.refreshData();
        this.reponseClient = '';
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

  // ========== WEBSOCKET TRACKING ==========
  initializeWebSocket(): void {
    try {
      // Déconnecter l'ancienne connexion si elle existe
      this.disconnectWebSocket();
      
      this.showToast('Tentative de reconnexion WebSocket...', 'info');
      
      this.socket = io(this.trackingServiceUrl);
      
      this.socket.on('connect', () => {
        console.log('🔌 WebSocket connecté au tracking service');
        this.socket.emit('subscribe-positions');
        this.socket.emit('subscribe-admin-notifications');
        this.socket.emit('subscribe-manifest-updates');
        
        // Recharger les données après connexion
        this.loadDepotsFromTracking();
        this.loadDriverPositionsFromTracking();
        
        // Initialiser la carte si elle ne l'est pas déjà
        if (!this.adminMap) {
          this.initMapAdmin();
        } else {
          // Mettre à jour la carte avec les nouvelles données
          this.updateMapWithRealData();
        }
        
        this.showToast('WebSocket reconnecté avec succès', 'success');
      });

      this.socket.on('initial-positions', (positions: any[]) => {
        console.log('📍 Positions initiales reçues:', positions.length);
        this.driverPositions = positions;
        if (this.activeTab === 'carte') {
          this.updateMapWithRealData();
        }
      });

      this.socket.on('position-update', (data: any) => {
        console.log('🔄 Position mise à jour:', data.livreurId);
        this.updateDriverPosition(data);
        if (this.activeTab === 'carte') {
          this.updateMarkerPosition(data);
        }
      });

      this.socket.on('status-update', (data: any) => {
        console.log('📊 Statut mis à jour:', data.livreurId, data.statut);
        this.updateDriverStatus(data);
        if (this.activeTab === 'carte') {
          this.updateMarkerStatus(data);
        }
      });

      this.socket.on('admin-alert', (alert: any) => {
        console.log('🚨 Alerte admin:', alert);
        this.showToast(alert.message, 'info');
      });

      this.socket.on('depot-added', (depot: any) => {
        console.log('🏬 Nouveau dépôt:', depot.nom);
        this.depotsPositions.push(depot);
        if (this.activeTab === 'carte') {
          this.addDepotToMap(depot);
        }
      });

      this.socket.on('manifest-created', (manifest: any) => {
        console.log('📋 Nouveau manifeste créé:', manifest.id);
        this.chargerManifests();
      });

      this.socket.on('manifest-status-update', (update: any) => {
        console.log('📋 Statut manifeste mis à jour:', update.manifestId, update.statut);
        const manifest = this.manifests.find(m => m.id === update.manifestId);
        if (manifest) {
          manifest.statut = update.statut;
          this.computeManifestStats();
        }
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 WebSocket déconnecté');
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erreur WebSocket:', error);
        this.showToast('Erreur de connexion WebSocket - Vérifiez que le service tracking est démarré', 'error');
      });

    } catch (error) {
      console.error('❌ Erreur initialisation WebSocket:', error);
    }
  }

  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  updateDriverPosition(data: any): void {
    const existingIndex = this.driverPositions.findIndex(d => d.livreurId === data.livreurId);
    if (existingIndex >= 0) {
      this.driverPositions[existingIndex] = { ...this.driverPositions[existingIndex], ...data };
    } else {
      this.driverPositions.push(data);
    }
  }

  updateDriverStatus(data: any): void {
    const driver = this.driverPositions.find(d => d.livreurId === data.livreurId);
    if (driver) {
      driver.statut = data.statut;
    }
  }

  // ========== MAP REAL DATA ==========
  updateMapWithRealData(): void {
    console.log('🗺️ Mise à jour de la carte avec les données réelles');
    console.log('📍 adminMap existe:', !!this.adminMap);
    console.log('📍 driverPositions:', this.driverPositions.length);
    console.log('📍 depotsPositions:', this.depotsPositions.length);
    
    if (!this.adminMap) {
      console.error('❌ adminMap n\'existe pas, initialisation annulée');
      return;
    }

    const L = (window as any).L;
    console.log('📍 Leaflet L existe:', !!L);
    
    // Nettoyer les marqueurs existants
    this.adminMap.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        this.adminMap.removeLayer(layer);
      }
    });

    // Ajouter les marqueurs des livreurs avec couleurs par statut
    console.log('📍 Ajout des marqueurs livreurs...');
    this.driverPositions.forEach((driver, index) => {
      const lat = driver.position?.latitude || 36.8065;
      const lon = driver.position?.longitude || 10.1815;
      
      console.log(`📍 Livreur ${index}: ${driver.nom} ${driver.prenom} - Position: [${lat}, ${lon}]`);
      
      const markerColor = this.getMarkerColorByStatus(driver.statut);
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const popupText = `
        <b>${driver.nom} ${driver.prenom}</b><br>
        Statut: ${driver.statut || 'DISPONIBLE'}<br>
        Gouvernorat: ${driver.gouvernorat || '—'}<br>
        Vitesse: ${driver.position?.speed || 0} km/h<br>
        Véhicule: ${driver.vehicule?.immatriculation || '—'}
      `;

      L.marker([lat, lon], { icon: markerIcon })
        .addTo(this.adminMap)
        .bindPopup(popupText);
    });

    // Ajouter les dépôts
    console.log('📍 Ajout des marqueurs dépôts...');
    this.depotsPositions.forEach((depot, index) => {
      const lat = depot.position?.latitude || 36.8065;
      const lon = depot.position?.longitude || 10.1815;
      
      console.log(`📍 Dépôt ${index}: ${depot.nom} - Position: [${lat}, ${lon}]`);
      
      const depotIcon = L.divIcon({
        className: 'depot-marker',
        html: `<div style="background: #8b5cf6; width: 40px; height: 40px; border-radius: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 18px;">🏬</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const depotPopup = `
        <b>${depot.nom}</b><br>
        Ville: ${depot.ville}<br>
        Capacité: ${depot.capaciteActuelle || 0}/${depot.capacite}<br>
        Statut: ${depot.statut}
      `;

      L.marker([lat, lon], { icon: depotIcon })
        .addTo(this.adminMap)
        .bindPopup(depotPopup);
    });
    
    console.log('✅ Mise à jour de la carte terminée');
  }

  updateMarkerPosition(data: any): void {
    if (!this.adminMap) return;
    const L = (window as any).L;
    
    // Trouver et mettre à jour le marqueur correspondant
    this.adminMap.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        const popup = layer.getPopup();
        if (popup && popup.getContent().includes(data.livreurId)) {
          const lat = data.position?.latitude;
          const lon = data.position?.longitude;
          if (lat && lon) {
            layer.setLatLng([lat, lon]);
          }
        }
      }
    });
  }

  updateMarkerStatus(data: any): void {
    if (!this.adminMap) return;
    const L = (window as any).L;
    
    this.adminMap.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        const popup = layer.getPopup();
        if (popup && popup.getContent().includes(data.livreurId)) {
          const markerColor = this.getMarkerColorByStatus(data.statut);
          const newIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          layer.setIcon(newIcon);
          
          // Mettre à jour le popup
          const popupContent = popup.getContent();
          const updatedContent = popupContent.replace(/Statut: [^<]+/, `Statut: ${data.statut}`);
          layer.setPopupContent(updatedContent);
        }
      }
    });
  }

  addDepotToMap(depot: any): void {
    if (!this.adminMap) return;
    const L = (window as any).L;
    
    const lat = depot.position?.latitude || 36.8065;
    const lon = depot.position?.longitude || 10.1815;
    
    const depotIcon = L.divIcon({
      className: 'depot-marker',
      html: `<div style="background: #8b5cf6; width: 40px; height: 40px; border-radius: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 18px;">🏬</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const depotPopup = `
      <b>${depot.nom}</b><br>
      Ville: ${depot.ville}<br>
      Capacité: ${depot.capaciteActuelle || 0}/${depot.capacite}<br>
      Statut: ${depot.statut}
    `;

    L.marker([lat, lon], { icon: depotIcon })
      .addTo(this.adminMap)
      .bindPopup(depotPopup);
  }

  getMarkerColorByStatus(statut: string): string {
    switch (statut) {
      case 'DISPONIBLE': return '#10b981'; // Vert
      case 'EN_COURSE': return '#f59e0b'; // Orange
      case 'EN_PAUSE': return '#64748b'; // Gris
      case 'HORS_SERVICE': return '#ef4444'; // Rouge
      default: return '#3b82f6'; // Bleu
    }
  }

  filterMapMarkers(): void {
    if (!this.adminMap) return;
    const L = (window as any).L;
    
    // Nettoyer les marqueurs
    this.adminMap.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        this.adminMap.removeLayer(layer);
      }
    });

    // Filtrer et afficher les positions
    const filteredPositions = this.driverPositions.filter(driver => {
      if (this.mapFilterStatut && driver.statut !== this.mapFilterStatut) return false;
      if (this.mapFilterGouvernorat && driver.gouvernorat !== this.mapFilterGouvernorat) return false;
      return true;
    });

    // Réafficher les marqueurs filtrés
    filteredPositions.forEach(driver => {
      const lat = driver.position?.latitude || 36.8065;
      const lon = driver.position?.longitude || 10.1815;
      
      const markerColor = this.getMarkerColorByStatus(driver.statut);
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const popupText = `
        <b>${driver.nom} ${driver.prenom}</b><br>
        Statut: ${driver.statut || 'DISPONIBLE'}<br>
        Gouvernorat: ${driver.gouvernorat || '—'}<br>
        Vitesse: ${driver.position?.speed || 0} km/h<br>
        Véhicule: ${driver.vehicule?.immatriculation || '—'}
      `;

      L.marker([lat, lon], { icon: markerIcon })
        .addTo(this.adminMap)
        .bindPopup(popupText);
    });

    // Toujours afficher les dépôts
    this.depotsPositions.forEach(depot => {
      const lat = depot.position?.latitude || 36.8065;
      const lon = depot.position?.longitude || 10.1815;
      
      const depotIcon = L.divIcon({
        className: 'depot-marker',
        html: `<div style="background: #8b5cf6; width: 40px; height: 40px; border-radius: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 18px;">🏬</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const depotPopup = `
        <b>${depot.nom}</b><br>
        Ville: ${depot.ville}<br>
        Capacité: ${depot.capaciteActuelle || 0}/${depot.capacite}<br>
        Statut: ${depot.statut}
      `;

      L.marker([lat, lon], { icon: depotIcon })
        .addTo(this.adminMap)
        .bindPopup(depotPopup);
    });
  }

  async loadDepotsFromTracking(): Promise<void> {
    try {
      const response = await fetch(`${this.trackingServiceUrl}/api/depots`);
      const depots = await response.json();
      this.depotsPositions = depots;
      if (this.activeTab === 'carte') {
        this.updateMapWithRealData();
      }
    } catch (error) {
      console.error('Erreur chargement dépôts:', error);
    }
  }

  async loadDriverPositionsFromTracking(): Promise<void> {
    try {
      console.log('🔄 Chargement des positions depuis:', `${this.trackingServiceUrl}/api/positions`);
      const response = await fetch(`${this.trackingServiceUrl}/api/positions`);
      const positions = await response.json();
      this.driverPositions = positions;
      console.log('📍 Positions des livreurs chargées:', positions.length, positions);
      if (this.activeTab === 'carte') {
        this.updateMapWithRealData();
      }
    } catch (error) {
      console.error('❌ Erreur chargement positions livreurs:', error);
    }
  }

  // ========== VEHICULES ==========
  showVehiculePanel = false;
  selectedVehicule: any = null;


  getVehiculesActifs(): number {
    return this.vehicules.filter(v => v.statut === 'EN_SERVICE' || v.statut === 'EN_COURSE').length;
  }

  getVehiculesMaintenance(): number {
    return this.vehicules.filter(v => v.statut === 'MAINTENANCE').length;
  }

  // Map getters pour éviter les expressions complexes dans le template
  getDriversDisponibles(): number {
    return this.driverPositions.filter(d => d.statut === 'DISPONIBLE').length;
  }

  getDriversEnCourse(): number {
    return this.driverPositions.filter(d => d.statut === 'EN_COURSE').length;
  }

  getDepotsCount(): number {
    return this.depotsPositions.length;
  }

  // Helper methods pour les expressions complexes du template
  getSelectedDriverForOrder(orderId: string): string {
    return this.selectedDrivers[orderId || ''] || '';
  }

  setSelectedDriverForOrder(orderId: string, value: string): void {
    this.selectedDrivers[orderId || ''] = value;
  }

  getSelectedDriverForManifest(manifestId: string): string {
    return this.selectedDrivers[manifestId || ''] || '';
  }

  setSelectedDriverForManifest(manifestId: string, value: string): void {
    this.selectedDrivers[manifestId || ''] = value;
  }

  setVehicleCapacity(value: number): void {
    this.selectedVehicule.capaciteKg = value;
  }

  getVehicleCapacity(): number {
    return this.selectedVehicule.capaciteKg || 0;
  }

  setVehicleStatus(value: string): void {
    this.selectedVehicule.statut = value;
  }

  getVehicleStatus(): string {
    return this.selectedVehicule.statut || '';
  }

  getCapaciteTotaleKg(): number {
    return this.vehicules.reduce((sum, v) => sum + (v.capaciteKg || v.capacite || 0), 0);
  }

  getDriverForVehicule(vehicule: any): string {
    if (!vehicule.livreurId) return 'Aucun livreur assigné';
    // Chercher dans les livreurs approuvés du service auth
    const driver = this.getLivreurUsers().find(l => l.id === vehicule.livreurId);
    return driver ? `${driver.prenom} ${driver.nom}` : 'Livreur inconnu';
  }

  openVehiculePanel(vehicule: any): void {
    this.selectedVehicule = vehicule;
    this.showVehiculePanel = true;
  }

  closeVehiculePanel(): void {
    this.showVehiculePanel = false;
    setTimeout(() => this.selectedVehicule = null, 300);
  }

  toggleVehiculeMaintenance(vehicule: any): void {
    const newStatus = vehicule.statut === 'MAINTENANCE' ? 'DISPONIBLE' : 'MAINTENANCE';
    this.apiService.updateVehicule(vehicule.id, { ...vehicule, statut: newStatus }).subscribe({
      next: (res) => {
        vehicule.statut = res.statut || newStatus;
        this.showToast(`Statut véhicule mis à jour`, 'success');
      },
      error: (err) => {
        console.error('Erreur mise à jour véhicule:', err);
        this.showToast('Erreur lors de la mise à jour du véhicule', 'error');
      }
    });
  }

  assignerLivreurVehicule(vehicule: any, event: any): void {
    const livreurId = event.target.value;
    if (!livreurId) return;

    // Vérifier que le livreur existe dans les livreurs approuvés
    const livreur = this.getLivreurUsers().find(l => l.id === livreurId);
    if (!livreur) {
      this.showToast('Livreur introuvable ou non approuvé', 'error');
      return;
    }

    this.apiService.affecterVehicule(livreurId, vehicule.id).subscribe({
      next: () => {
        vehicule.livreurId = livreurId;
        this.showToast(`Véhicule assigné à ${livreur.prenom} ${livreur.nom}`, 'success');
      },
      error: (err) => {
        console.error('Erreur assignation véhicule:', err);
        this.showToast('Erreur lors de l\'assignation du véhicule', 'error');
      }
    });
  }

  addVehiculeAndReset(): void {
    if (!this.nouveauVehicule.immatriculation || !this.nouveauVehicule.modele) {
      this.showToast('Veuillez remplir l\'immatriculation et le modèle', 'error');
      return;
    }
    
    const vToCreate = {
      immatriculation: this.nouveauVehicule.immatriculation,
      modele: this.nouveauVehicule.modele,
      capaciteKg: this.nouveauVehicule.capaciteKg || 1000,
      capaciteVolume: 5,
      type: this.nouveauVehicule.type || 'UTILITAIRE',
      annee: 2023,
      statut: 'DISPONIBLE',
      marque: 'Inconnue'
    };

    this.apiService.creerVehicule(vToCreate as any).subscribe({
      next: (res) => {
        this.vehicules.push(res);
        this.showToast('Véhicule ajouté', 'success');
        this.nouveauVehicule = { immatriculation: '', modele: '', capaciteKg: 1000, type: 'UTILITAIRE' };
      },
      error: (err) => {
        console.error('Erreur création véhicule:', err);
        this.showToast('Création échouée', 'error');
      }
    });
  }

  removeVehicule(id: string): void {
    if (confirm('Supprimer ce véhicule ?')) {
      this.apiService.deleteVehicule(id).subscribe({
        next: () => {
          this.vehicules = this.vehicules.filter(v => v.id !== id);
          this.showToast('Véhicule supprimé', 'success');
        },
        error: () => {
          this.showToast('Erreur suppression', 'error');
        }
      });
    }
  }

  updateVehicleCapacity(id: string, capacite: number): void {
    const v = this.vehicules.find(x => x.id === id);
    if (!v) return;
    v.capaciteKg = capacite;
    this.apiService.updateVehicule(id, v as any).subscribe();
  }

  updateVehicleStatus(id: string, statut: string): void {
    const v = this.vehicules.find(x => x.id === id);
    if (!v) return;
    v.statut = statut;
    this.apiService.updateVehicule(id, v as any).subscribe();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/home']);
  }
}