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
  templateUrl: './dashboard-admin.component.html',
  styleUrls: ['./dashboard-admin.component.scss']
})
export class DashboardAdminComponent implements OnInit {
  activeTab: 'commandes' | 'inscriptions' | 'livreurs' | 'depots' | 'vehicules' | 'carte' | 'stats' | 'manifests' = 'commandes';
  commandes: Commande[] = [];
  livreurs: Livreur[] = [];
  usersList: UserProfile[] = [];
  depots: any[] = [];
  vehicules: any[] = [];
  manifests: any[] = []; // Pour la gestion des manifests

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
    statut: 'INSCRIPTION'
  };

  // Formulaire nouveau véhicule
  nouveauVehicule: any = {
    immatriculation: '',
    modele: '',
    marque: '',
    type: 'Voiture',
    capacite: 10,
    statut: 'DISPONIBLE'
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

  // === GESTION DES LIVREURS ===

  // Enregistrer un nouveau livreur
  enregistrerLivreur() {
    if (!this.nouveauLivreur.nom || !this.nouveauLivreur.prenom || !this.nouveauLivreur.gouvernorat) {
      alert('Veuillez remplir tous les champs obligatoires');
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
        alert('Livreur enregistré avec succès ! Un email de confirmation sera envoyé.');
        this.refreshData();
      },
      error: (err) => {
        // En mode local si backend non disponible
        this.livreurs.push(nouveauLivreur);
        this.resetLivreurForm();
        alert('Livreur enregistré en mode local (backend non disponible)');
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
          alert(`Livreur ${livreur.prenom} ${livreur.nom} validé !`);
          this.refreshData();
        },
        error: () => {
          alert('Livreur validé en mode local');
          this.refreshData();
        }
      });
    }
  }

  // Affecter un livreur à un gouvernorat
  affecterGouvernorat(livreurId: string, gouvernorat: string) {
    const livreur = this.livreurs.find(l => l.id === livreurId);
    if (livreur) {
      livreur.gouvernorat = gouvernorat;
      this.apiService.updateLivreur(livreurId, { gouvernorat }).subscribe({
        next: () => {
          alert(`Livreur affecté à ${gouvernorat}`);
          this.refreshData();
        },
        error: () => {
          alert('Affectation enregistrée en mode local');
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
          alert('Livreur suspendu');
          this.refreshData();
        },
        error: () => {
          alert('Livreur suspendu en mode local');
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
          alert('Livreur réactivé');
          this.refreshData();
        },
        error: () => {
          alert('Livreur réactivé en mode local');
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
      vehicule.livreurId = livreurId;
      vehicule.statut = 'EN_UTILISATION';
      livreur.vehiculeId = vehiculeId;
      
      localStorage.setItem('bf_vehicules', JSON.stringify(this.vehicules));
      alert(`Véhicule ${vehicule.immatriculation} affecté à ${livreur.prenom} ${livreur.nom}`);
      this.refreshData();
    }
  }

  // Libérer un véhicule
  libererVehicule(vehiculeId: string) {
    const vehicule = this.vehicules.find(v => v.id === vehiculeId);
    if (vehicule && vehicule.livreurId) {
      const livreur = this.livreurs.find(l => l.id === vehicule.livreurId);
      if (livreur) {
        livreur.vehiculeId = undefined;
      }
      vehicule.livreurId = undefined;
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

    // Charger les manifests
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
