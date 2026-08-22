import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApiService, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PdfService } from '../../services/pdf.service';
import { WebSocketService } from '../../services/websocket.service';
import { io, Socket } from 'socket.io-client';
import { Subscription } from 'rxjs';

export interface Reclamation {
  id?: string;
  objet: string;
  codeBarre: string;
  description: string;
  dateCreation: Date | string;
  statut: string;
}

export interface TeamMember {
  initials: string;
  nom: string;
  poste: string;
  tel: string;
  photo?: string;
  rating?: number;
  bio?: string;
  // Nouvelles propriétés pour profils enrichis
  photoUrl?: string;
  disponibility: 'DISPONIBLE' | 'EN_APPEL' | 'ABSENT' | 'DEJEUNE';
  langues: string[];
  specialisations: string[];
  notes?: string;
  isFavorite?: boolean;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

@Component({
  selector: 'app-dashboard-client',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard-client.component.html',
  styleUrls: ['./dashboard-client.component.scss']
})
export class DashboardClientComponent implements OnInit, OnDestroy {

  activeTab = 'dashboard';
  clientName = 'Client';
  clientId = '';

  commandes: Commande[] = [];
  pendingCommandes: Commande[] = [];
  validatedManifests: any[] = [];
  reclamationsList: any[] = [];
  colisList: any[] = []; // Ajouté pour stocker les colis

  searchTerm = '';
  searchResult: Commande | null = null;
  showManifestHistory = false;

  // Manifest view and filters
  manifestViewMode: 'list' | 'grid' = 'list';
  manifestFilters = {
    governorate: '',
    minCOD: 0,
    maxCOD: 0,
    serviceType: '',
    search: ''
  };
  selectedColis: Set<string> = new Set();
  clientInfo: any = null;

  // Manifest details sidebar
  showManifestDetail = false;
  selectedManifest: any = null;
  manifestColis: any[] = [];

  // Real-time tracking
  private socket: Socket | null = null;
  private trackingServiceUrl = 'http://localhost:8090';
  manifestNotifications: any[] = [];
  manifestStatusUpdates: any[] = [];

  // Service Client enhancements
  showMemberDetail = false;
  selectedMember: TeamMember | null = null;
  serviceStats = {
    totalMembers: 0,
    available: 0,
    inCall: 0,
    absent: 0,
    avgResponseTime: '1h 30min'
  };
  showRdvModal = false;
  memberNotes: string = '';
  rdvDate = '';
  rdvTime = '';

  // Reclamations filters
  reclamationFilter = 'ALL'; // ALL, EN_ATTENTE, EN_COURS, RESOLUE

  // Reclamation details sidebar
  showReclamationDetails = false;
  selectedReclamation: any = null;

  // Reclamations list sidebar
  showReclamationsSidebar = false;
  reclamationsSidebarFilter = 'ALL'; // ALL, EN_ATTENTE, RESOLUE
  selectedSidebarReclamation: any = null; // Réclamation sélectionnée pour afficher la réponse

  loading = false;
  errorMessage = '';
  successMessage = '';
  reclamationSuccessMsg = '';

  private refreshInterval: any = null;
  private wsSubscription: Subscription | null = null;

  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;

  month = 'Août';
  year = '2026';
  months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  years = ['2024', '2025', '2026', '2027', '2028'];

  packageForm!: FormGroup;
  reclamationForm!: FormGroup;

  gouvernorats: string[] = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
    'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse',
    'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid',
    'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
  ];

  objetOptions: string[] = [
    'Retard de livraison',
    'Colis perdu',
    'Échange non reçu',
    'Retour non reçu',
    'Colis endommagé',
    'Colis non payé',
    'Paiement non reçu',
    'Manque paiement',
    'Chèque non reçu',
    'Échec de livraison'
  ];

  teamMembers: TeamMember[] = [
    {
      initials: 'FB',
      nom: 'Farid Bouzouita',
      poste: 'Responsable Service Client',
      tel: '+216 98 218 003',
      rating: 4.9,
      bio: 'Spécialiste des réclamations et du suivi des livraisons.',
      photoUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
      disponibility: 'DISPONIBLE',
      langues: ['Français', 'Arabe', 'Anglais'],
      specialisations: ['Réclamations', 'Suivi livraisons', 'Facturation'],
      isFavorite: true
    },
    {
      initials: 'DB',
      nom: 'Donia Bouzouita',
      poste: 'Service Client',
      tel: '+216 57 178 469',
      rating: 4.8,
      bio: 'Accompagnement des clients professionnels et gestion des retours.',
      photoUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
      disponibility: 'EN_APPEL',
      langues: ['Français', 'Anglais'],
      specialisations: ['Support technique', 'API', 'Intégration']
    },
    {
      initials: 'CB',
      nom: 'Chirine Bouzouita',
      poste: 'Service Client',
      tel: '+216 57 178 491',
      rating: 4.7,
      bio: 'Support technique et assistance pour les nouveaux clients.',
      photoUrl: 'https://randomuser.me/api/portraits/women/28.jpg',
      disponibility: 'ABSENT',
      langues: ['Français', 'Arabe'],
      specialisations: ['Support technique', 'Onboarding', 'Formation']
    }
  ];

  detailedStatuses = [
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

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private pdfService: PdfService,
    private webSocketService: WebSocketService
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clientName = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Client';
      this.clientId = user.id;
      this.clientInfo = {
        id: user.id,
        name: this.clientName,
        phone: ''
      };
      this.loadClientCommandes();
      this.loadReclamations();
      // loadManifests sera appelé après le chargement des commandes
      this.startRealTimeUpdates();
      this.initializeTrackingSocket();
      this.updateServiceStats();

      // Rafraîchissement automatique des réclamations toutes les 30 secondes
      this.refreshInterval = setInterval(() => {
        this.loadReclamations();
      }, 30000);

      // Connecter WebSocket pour les mises à jour de réclamations
      this.webSocketService.connect(this.clientId);
      this.wsSubscription = this.webSocketService.getReclamationUpdates().subscribe({
        next: (update) => {
          console.log('📩 Mise à jour réclamation reçue:', update);
          if (update.type === 'NEW_RESPONSE') {
            this.showToast('💬 Nouvelle réponse du support pour votre réclamation !', 'success');
            this.loadReclamations(); // Recharger les réclamations
          } else if (update.type === 'STATUS_UPDATE') {
            this.showToast('🔄 Statut de votre réclamation mis à jour', 'info');
            this.loadReclamations();
          }
        },
        error: (err) => {
          console.error('❌ Erreur WebSocket:', err);
        }
      });
    }
  }

  ngOnDestroy(): void {
    // Nettoyer l'intervalle de rafraîchissement
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.disconnectTrackingSocket();

    // Déconnecter WebSocket
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    this.webSocketService.disconnect();
  }

  private initializeTrackingSocket(): void {
    try {
      this.socket = io(this.trackingServiceUrl);

      this.socket.on('connect', () => {
        console.log('🔌 Socket tracking connecté');
        // S'abonner aux notifications client
        this.socket.emit('subscribe-client-notifications', this.clientId);
      });

      this.socket.on('manifest-status-update', (data: any) => {
        console.log('📢 Mise à jour statut manifeste:', data);
        this.manifestStatusUpdates.unshift({
          ...data,
          timestamp: new Date()
        });
        
        // Mettre à jour le manifeste local si nécessaire
        const manifestIndex = this.validatedManifests.findIndex(m => m.id === data.manifestId);
        if (manifestIndex !== -1) {
          this.validatedManifests[manifestIndex].statut = data.statut;
        }
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Socket tracking déconnecté');
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ Erreur connexion socket tracking:', error);
      });
    } catch (error) {
      console.error('❌ Erreur initialisation socket tracking:', error);
    }
  }

  private disconnectTrackingSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startRealTimeUpdates(): void {
    // Refresh data every 15 seconds for real-time tracking
    this.refreshInterval = setInterval(() => {
      this.loadClientCommandes();
      this.loadReclamations();
      this.loadColisForClient(); // Also refresh colis for real-time updates
    }, 15000);
  }

  private initForms(): void {
    this.packageForm = this.fb.group({
      pickupName: ['', [Validators.required, Validators.minLength(3)]],
      governorate: ['', Validators.required],
      city: ['', [Validators.required, Validators.minLength(2)]],
      locality: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10)]],
      phone1: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{8,15}$/)]],
      phone2: ['', [Validators.pattern(/^[0-9+ ]{8,15}$/)]],
      designation: ['', [Validators.required, Validators.minLength(5)]],
      price: [null, [Validators.required, Validators.min(0)]],
      itemCount: [1, [Validators.required, Validators.min(1)]],
      packageCount: [1, [Validators.required, Validators.min(1)]],
      paymentMode: ['Espèce seulement', Validators.required],
      openBeforePayment: ['Non', Validators.required],
      exchange: ['Non', Validators.required],
      typeService: ['STANDARD', Validators.required],
      remarks: ['', Validators.maxLength(500)]
    });

    this.reclamationForm = this.fb.group({
      objet: ['', Validators.required],
      codeBarre: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', Validators.maxLength(1000)]
    });
  }

  // ========== NAVIGATION ==========
  setTab(tab: string): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.searchResult = null;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ========== DATA ==========
  loadClientCommandes(): void {
    if (!this.clientId) return;

    this.loading = true;
    this.apiService.getCommandesByClient(this.clientId).subscribe({
      next: (res) => {
        this.commandes = res || [];
        this.pendingCommandes = this.commandes.filter(c => c.statut === 'EN_ATTENTE');
        // Charger les colis associés pour le suivi temps réel
        this.loadColisForClient();
        // Charger les manifestes après avoir les commandes pour le calcul du Total COD
        this.loadManifests();
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement commandes:', err);
        this.errorMessage = 'Erreur lors du chargement des commandes';
        this.commandes = [];
        this.pendingCommandes = [];
        this.loading = false;
      }
    });
  }

  loadColisForClient(): void {
    if (!this.clientId) return;

    this.apiService.getColisByClient(this.clientId).subscribe({
      next: (colis) => {
        this.colisList = colis || [];
        // Update commandes with colis status for real-time tracking
        this.commandes.forEach(cmd => {
          const cmdColis = this.colisList.filter(c => c.commandeId === cmd.id);
          if (cmdColis.length > 0) {
            // Use the latest colis status
            const latestColis = cmdColis[cmdColis.length - 1];
            if (latestColis.statut && latestColis.statut !== 'EN_ATTENTE') {
              cmd.statut = latestColis.statut;
            }
          }
        });
      },
      error: (err) => {
        console.error('Erreur chargement colis:', err);
      }
    });
  }

  loadManifests(): void {
    if (!this.clientId) return;

    console.log('📦 Chargement des manifestes pour client:', this.clientId);
    console.log('📦 Commandes disponibles:', this.commandes);

    this.apiService.getManifestesByClient(this.clientId).subscribe({
      next: (res) => {
        console.log('📦 Manifestes reçus:', res);
        
        this.validatedManifests = (res || [])
          .filter((m: any) => m.statut !== 'BROUILLON')
          .map((m: any) => {
            console.log('📦 Traitement manifeste:', m);
            
            // Calculer le total COD en utilisant les commandes correspondantes
            const manifestColis = m.commandeIds || [];
            console.log('📦 CommandeIds du manifeste:', manifestColis);
            
            const totalCOD = manifestColis.reduce((sum: number, id: string) => {
              const commande = this.commandes.find(c => c.id === id);
              console.log(`📦 Recherche commande ${id}:`, commande);
              if (commande) {
                console.log(`📦 MontantTotal de la commande ${id}:`, commande.montantTotal);
                return sum + (commande.montantTotal || 0);
              }
              console.log(`📦 Commande ${id} non trouvée`);
              return sum;
            }, 0);
            
            console.log(`📦 Total COD calculé pour manifeste ${m.id}:`, totalCOD);
            
            return {
              ...m,
              totalCOD: totalCOD
            };
          });
          
        console.log('📦 Manifestes traités avec Total COD:', this.validatedManifests);
      },
      error: (err) => console.error('Erreur chargement manifestes:', err)
    });
  }

  loadReclamations(): void {
    if (!this.clientId) return;

    console.log('📝 Chargement des réclamations pour client:', this.clientId);

    this.apiService.getReclamationsByClient(this.clientId).subscribe({
      next: (reclamations) => {
        console.log('📝 Réclamations reçues (brutes):', reclamations);

        this.reclamationsList = (reclamations || []).map((r: any) => {
          const mapped = {
            id: r.id,
            objet: r.type || r.objet,
            codeBarre: r.commandeId || r.codeBarre,
            description: r.description,
            dateCreation: r.dateCreation || new Date().toISOString(), // Valeur par défaut si null
            statut: r.statut,
            reponseAdmin: r.reponseAdmin,  // Réponse de l'admin visible par le client
            dateReponse: r.dateReponse  // Date de la réponse
          };

          console.log(`📝 Réclamation ${r.id} mappée:`, mapped);
          console.log(`📝 Date de création pour ${r.id}:`, r.dateCreation);
          console.log(`📝 Réponse admin pour ${r.id}:`, r.reponseAdmin);

          return mapped;
        });

        // Mettre à jour la réclamation sélectionnée si elle est ouverte
        if (this.selectedReclamation) {
          const updatedReclamation = this.reclamationsList.find(r => r.id === this.selectedReclamation.id);
          if (updatedReclamation) {
            this.selectedReclamation = updatedReclamation;
            console.log('📝 Réclamation sélectionnée mise à jour:', this.selectedReclamation);
          }
        }

        console.log('📝 Liste des réclamations mappée:', this.reclamationsList);
        console.log('📝 Réclamations avec réponse:', this.reclamationsList.filter(r => r.reponseAdmin));
      },
      error: (err) => {
        console.error('❌ Erreur chargement réclamations:', err);
        this.reclamationsList = [];
      }
    });
  }

  // ========== STATS ==========
  getStatusCount(status: string): number {
    return this.commandes.filter(c => c.statut === status).length;
  }

  getMontantARegler(): number {
    return this.commandes
      .filter(c => c.statut === 'LIVRE' || c.statut === 'LIVRE_PAYE')
      .reduce((sum, c) => sum + (c.montantTotal || 0), 0);
  }

  calculateRetourRate(): number {
    const total = this.commandes.length;
    if (total === 0) return 0;
    const retours = this.commandes.filter(c =>
      ['RETOUR_DEPOT', 'RETOUR_EXPEDITEUR', 'ECHEC_LIVRAISON'].includes(c.statut || '')
    ).length;
    return Math.round((retours / total) * 100);
  }

  getRetourStatusClass(): string {
    const rate = this.calculateRetourRate();
    if (rate < 10) return 'good';
    if (rate < 20) return 'warning';
    return 'bad';
  }

  getRetourStatusText(): string {
    const rate = this.calculateRetourRate();
    if (rate < 10) return 'Excellent — sous l’objectif (< 10%)';
    if (rate < 20) return 'Attention — proche de la limite';
    return 'Critique — au-dessus de l’objectif';
  }

  filterByStatus(status: string): void {
    this.searchTerm = status;
    this.setTab('mes-commandes');
  }

  // ========== BORDEREAU ==========
  getCommandesReglement(): Commande[] {
    return this.commandes.filter(c =>
      c.statut === 'LIVRE' || c.statut === 'LIVRE_PAYE'
    );
  }

  getMontantCollecte(): number {
    return this.getCommandesReglement()
      .reduce((sum, c) => sum + (c.montantTotal || 0), 0);
  }

  getFraisForCommande(cmd: Commande): number {
    return cmd.typeService === 'EXPRESS' ? 8 : 5;
  }

  getFraisLivraison(): number {
    return this.getCommandesReglement()
      .reduce((sum, c) => sum + this.getFraisForCommande(c), 0);
  }

  getNetARegler(): number {
    return this.getMontantCollecte() - this.getFraisLivraison();
  }

  validatePayments(): void {
    if (!this.clientId) return;

    const moisIndex = this.months.indexOf(this.month) + 1;
    const anneeNum = parseInt(this.year, 10);

    this.loading = true;
    this.apiService.getReglementsByClient(this.clientId, moisIndex, anneeNum).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur règlements:', err);
        this.errorMessage = 'Erreur lors du chargement des règlements';
        this.loading = false;
      }
    });
  }

  // ========== RETOURS ==========
  getRetourCommandes(): Commande[] {
    return this.commandes.filter(c =>
      ['RETOUR_DEPOT', 'RETOUR_EXPEDITEUR', 'ECHEC_LIVRAISON'].includes(c.statut || '')
    );
  }

  // ========== FORM HELPERS ==========
  isInvalid(controlName: string, form: FormGroup = this.packageForm): boolean {
    const control = form.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getError(controlName: string, form: FormGroup = this.packageForm): string {
    const control = form.get(controlName);
    if (!control?.errors) return '';
    if (control.errors['required']) return 'Ce champ est obligatoire';
    if (control.errors['minlength']) {
      return `Minimum ${control.errors['minlength'].requiredLength} caractères`;
    }
    if (control.errors['maxlength']) {
      return `Maximum ${control.errors['maxlength'].requiredLength} caractères`;
    }
    if (control.errors['min']) return 'La valeur doit être positive';
    if (control.errors['pattern']) return 'Format invalide';
    return 'Champ invalide';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  // ========== NOUVELLE COMMANDE ==========
  submitPickup(): void {
    if (this.packageForm.invalid) {
      this.markFormGroupTouched(this.packageForm);
      this.errorMessage = 'Veuillez corriger les erreurs du formulaire.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const formValue = this.packageForm.value;

    // Créer l'adresse de destination (arrivée)
    const adresseArrivee = {
      gouvernorat: formValue.governorate,
      ville: formValue.city?.trim(),
      localite: formValue.locality?.trim(),
      rue: formValue.address?.trim(),
      telephone: formValue.phone1?.trim()
    };

    // Créer l'adresse de départ (adresse par défaut du client)
    const adresseDepart = {
      gouvernorat: 'Tunis',
      ville: 'Tunis',
      localite: 'Centre',
      rue: 'Siège social',
      telephone: '+216 71 000 000',
      adressePrincipale: true
    };

    // Créer d'abord les adresses
    this.apiService.creerAdresse(adresseDepart).subscribe({
      next: (depart) => {
        this.apiService.creerAdresse(adresseArrivee).subscribe({
          next: (arrivee) => {
            // Maintenant créer la commande avec les IDs d'adresses
            const commande: any = {
              clientId: this.clientId,
              adresseDepartId: depart.id,
              adresseArriveeId: arrivee.id,
              typeService: formValue.typeService,
              montantTotal: formValue.price || 0,
              nomDestinataire: formValue.pickupName?.trim(),
              telephoneDestinataire: formValue.phone1?.trim(),
              telephone: formValue.phone1?.trim(),
              telephone2: formValue.phone2?.trim() || null,
              gouvernorat: formValue.governorate,
              ville: formValue.city?.trim(),
              localite: formValue.locality?.trim(),
              adresseComplete: formValue.address?.trim(),
              designation: formValue.designation?.trim(),
              nombreArticles: formValue.itemCount || 1,
              nombreColis: formValue.packageCount || 1,
              modePaiement: formValue.paymentMode,
              ouvertureAvantPaiement: formValue.openBeforePayment === 'Oui',
              echangePossible: formValue.exchange === 'Oui',
              remarques: formValue.remarks?.trim() || null,
              statut: 'EN_ATTENTE',
              colis: [{
                clientId: this.clientId,
                poids: 1.0,
                fragile: false,
                statut: 'EN_ATTENTE'
              }]
            };

            this.apiService.creerCommande(commande).subscribe({
              next: () => {
                this.loading = false;
                this.packageForm.reset({
                  itemCount: 1,
                  packageCount: 1,
                  paymentMode: 'Espèce seulement',
                  openBeforePayment: 'Non',
                  exchange: 'Non',
                  typeService: 'STANDARD'
                });
                this.loadClientCommandes();
                this.setTab('manifest');
              },
              error: (err) => {
                this.loading = false;
                this.errorMessage =
                  err.error?.message || err.message || 'Erreur lors de la création de la commande.';
              }
            });
          },
          error: (err) => {
            this.loading = false;
            this.errorMessage =
              err.error?.message || err.message || 'Erreur lors de la création de l\'adresse de destination.';
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err.error?.message || err.message || 'Erreur lors de la création de l\'adresse de départ.';
      }
    });
  }

  // ========== MANIFESTE ==========
  calculateManifestTotal(): number {
    return this.pendingCommandes.reduce(
      (sum, c) => sum + (c.montantTotal || (c as any).prix || 0),
      0
    );
  }

  validerEtImprimerManifest(): void {
    if (this.pendingCommandes.length === 0) {
      this.errorMessage = 'Aucun colis en attente à valider.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const manifeste = {
      clientId: this.clientId,
      clientNom: `${this.clientInfo?.prenom || ''} ${this.clientInfo?.nom || ''}`,
      nombreColis: this.pendingCommandes.length,
      commandeIds: this.pendingCommandes.map(c => c.id).filter(id => !!id),
      statut: 'BROUILLON'
    };

    this.apiService.creerManifeste(manifeste).subscribe({
      next: (manifest) => {
        if (!manifest || !manifest.id) {
          this.loading = false;
          this.errorMessage = 'Erreur: ID manifeste non reçu';
          return;
        }

        this.apiService.validerManifeste(manifest.id).subscribe({
          next: () => {
            this.loading = false;
            
            // Enregistrer dans le tracking service
            const totalCOD = this.calculateManifestTotal();
            this.registerManifestTracking(manifest.id, totalCOD);
            
            this.pendingCommandes = [];
            this.loadClientCommandes();
            this.loadManifests();
            this.errorMessage = '';
            this.successMessage = 'Manifeste validé avec succès!';
            
            // Générer le PDF du manifeste
            this.pdfService.generateManifestPDF(manifest, [], this.clientInfo);
          },
          error: (err) => {
            this.loading = false;
            console.error('Erreur validation manifeste:', err);
            this.errorMessage = 'Erreur lors de la validation du manifeste. Vérifiez que les commandes sont valides.';
          }
        });
      },
      error: (err) => {
        this.loading = false;
        console.error('Erreur création manifeste:', err);
        this.errorMessage = 'Erreur lors de la création du manifeste. Vérifiez que vous avez des commandes en attente.';
      }
    });
  }

  validerManifestPickup(): void {
    if (this.selectedColis.size === 0) {
      this.errorMessage = 'Veuillez sélectionner au moins un colis pour le pickup.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const selectedColisList = this.pendingCommandes.filter(c => this.selectedColis.has(c.id));
    const manifeste = {
      clientId: this.clientId,
      nombreColis: selectedColisList.length,
      commandeIds: selectedColisList.map(c => c.id).filter(id => !!id),
      statut: 'BROUILLON'
    };

    this.apiService.creerManifeste(manifeste).subscribe({
      next: (manifest) => {
        if (!manifest || !manifest.id) {
          this.loading = false;
          this.errorMessage = 'Erreur: ID manifeste non reçu';
          return;
        }

        this.apiService.validerManifeste(manifest.id).subscribe({
          next: () => {
            this.loading = false;

            // Retirer les colis sélectionnés de la liste en attente
            this.pendingCommandes = this.pendingCommandes.filter(c => !this.selectedColis.has(c.id));
            this.selectedColis.clear();

            // Enregistrer dans le tracking service
            const totalCOD = selectedColisList.reduce((sum, c) => sum + (c.montantTotal || 0), 0);
            this.registerManifestTracking(manifest.id, totalCOD);

            this.loadClientCommandes();
            this.loadManifests();
            this.errorMessage = '';
            this.successMessage = `Pickup validé avec ${selectedColisList.length} colis!`;

            // Générer le PDF du manifeste
            this.pdfService.generateManifestPDF(manifest, selectedColisList, this.clientInfo);
          },
          error: (err) => {
            this.loading = false;
            console.error('Erreur validation pickup:', err);
            this.errorMessage = 'Erreur lors de la validation du pickup. Vérifiez que les commandes sont valides.';
          }
        });
      },
      error: (err) => {
        this.loading = false;
        console.error('Erreur création manifeste pickup:', err);
        this.errorMessage = 'Erreur lors de la création du manifeste. Vérifiez que vous avez des commandes en attente.';
      }
    });
  }

  removeFromManifest(cmd: Commande): void {
    this.pendingCommandes = this.pendingCommandes.filter(c => c.id !== cmd.id);
  }

  private registerManifestTracking(manifestId: string, totalCOD: number): void {
    if (!this.socket) return;

    this.socket.emit('register-manifest', {
      manifestId,
      clientId: this.clientId,
      clientName: this.clientName,
      nombreColis: this.pendingCommandes.length,
      totalCOD
    });
  }

  // ========== MANIFEST DETAILS SIDEBAR ==========
  openManifestDetail(manifest: any): void {
    this.selectedManifest = manifest;
    this.loadManifestColis(manifest);
    this.showManifestDetail = true;
  }

  closeManifestDetail(): void {
    this.showManifestDetail = false;
    this.selectedManifest = null;
    this.manifestColis = [];
  }

  loadManifestColis(manifest: any): void {
    if (!manifest || !manifest.commandeIds) {
      this.manifestColis = [];
      return;
    }

    // Charger les détails des colis depuis les commandes existantes
    this.manifestColis = manifest.commandeIds.map((id: string) => {
      const commande = this.commandes.find(c => c.id === id);
      return commande || { id, info: 'Détails non disponibles' };
    });
  }

  telechargerManifest(manifest: any): void {
    console.log('📥 Téléchargement manifeste:', manifest);
    console.log('📥 Commandes disponibles:', this.commandes);
    
    const manifestColis = manifest.commandeIds.map((id: string) => {
      const commande = this.commandes.find(c => c.id === id);
      console.log(`📥 Recherche commande ${id}:`, commande);
      return commande || { id, info: 'Détails non disponibles' };
    });
    
    console.log('📥 Colis du manifeste:', manifestColis);
    this.pdfService.generateManifestPDF(manifest, manifestColis, this.clientInfo);
  }

  // ========== MANIFEST VIEW & FILTERS ==========
  toggleManifestView(): void {
    this.manifestViewMode = this.manifestViewMode === 'list' ? 'grid' : 'list';
  }

  toggleColisSelection(colisId: string): void {
    if (this.selectedColis.has(colisId)) {
      this.selectedColis.delete(colisId);
    } else {
      this.selectedColis.add(colisId);
    }
  }

  selectAllColis(): void {
    this.pendingCommandes.forEach(cmd => {
      if (cmd.id) {
        this.selectedColis.add(cmd.id);
      }
    });
  }

  deselectAllColis(): void {
    this.selectedColis.clear();
  }

  getFilteredPendingCommandes(): Commande[] {
    let filtered = [...this.pendingCommandes];

    // Search filter
    if (this.manifestFilters.search) {
      const search = this.manifestFilters.search.toLowerCase();
      filtered = filtered.filter(cmd => 
        (cmd.codeBarre || cmd.id || '').toLowerCase().includes(search) ||
        (cmd.nomDestinataire || '').toLowerCase().includes(search) ||
        (cmd.telephone || '').includes(search)
      );
    }

    // Governorate filter (using adresseArrivee.gouvernorat)
    if (this.manifestFilters.governorate) {
      filtered = filtered.filter(cmd => 
        cmd.adresseArrivee?.gouvernorat === this.manifestFilters.governorate
      );
    }

    // Service type filter
    if (this.manifestFilters.serviceType) {
      filtered = filtered.filter(cmd => 
        cmd.typeService === this.manifestFilters.serviceType
      );
    }

    // COD range filter
    if (this.manifestFilters.minCOD > 0) {
      filtered = filtered.filter(cmd => 
        (cmd.montantTotal || 0) >= this.manifestFilters.minCOD
      );
    }

    if (this.manifestFilters.maxCOD > 0) {
      filtered = filtered.filter(cmd => 
        (cmd.montantTotal || 0) <= this.manifestFilters.maxCOD
      );
    }

    return filtered;
  }

  resetManifestFilters(): void {
    this.manifestFilters = {
      governorate: '',
      minCOD: 0,
      maxCOD: 0,
      serviceType: '',
      search: ''
    };
    this.selectedColis.clear();
  }

  // ========== MANIFEST STATISTICS ==========
  getManifestStats(): any {
    const commandes = this.validatedManifests;
    if (commandes.length === 0) {
      return {
        totalManifests: 0,
        avgColisPerManifest: 0,
        totalColis: 0,
        totalCOD: 0
      };
    }

    const totalColis = commandes.reduce((sum, m) => sum + (m.nombreColis || 0), 0);
    const totalCOD = commandes.reduce((sum, m) => sum + (m.totalCOD || 0), 0);

    return {
      totalManifests: commandes.length,
      avgColisPerManifest: Math.round(totalColis / commandes.length),
      totalColis: totalColis,
      totalCOD: totalCOD
    };
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) {
      console.log('⚠️ Date manquante dans formatDate');
      return '—';
    }
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        console.log('⚠️ Date invalide:', date);
        return 'Date invalide';
      }
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.log('⚠️ Erreur formatDate:', e, 'date:', date);
      return String(date);
    }
  }

  async imprimerEtiquette(cmd: Commande): Promise<void> {
    try {
      await this.pdfService.generateShippingLabel(cmd, this.clientInfo);
      this.successMessage = 'Étiquette générée avec succès';
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error) {
      console.error('Erreur génération étiquette:', error);
      this.errorMessage = 'Erreur lors de la génération de l\'étiquette';
      setTimeout(() => this.errorMessage = '', 3000);
    }
  }

  async imprimerToutesEtiquettes(): Promise<void> {
    try {
      await this.pdfService.generateBulkShippingLabels(this.pendingCommandes, this.clientInfo);
      this.successMessage = 'Étiquettes générées avec succès';
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error) {
      console.error('Erreur génération étiquettes:', error);
      this.errorMessage = 'Erreur lors de la génération des étiquettes';
      setTimeout(() => this.errorMessage = '', 3000);
    }
  }

  async reprintManifest(manifest: any): Promise<void> {
    try {
      await this.pdfService.generateManifestPDF(manifest, manifest.colis || [], this.clientInfo);
      this.successMessage = 'Manifeste réimprimé avec succès';
      setTimeout(() => this.successMessage = '', 3000);
    } catch (error) {
      console.error('Erreur réimpression manifeste:', error);
      this.errorMessage = 'Erreur lors de la réimpression du manifeste';
      setTimeout(() => this.errorMessage = '', 3000);
    }
  }

  // ========== RECHERCHE ==========
  get filteredCommandes(): Commande[] {
    if (!this.searchTerm?.trim()) return this.commandes;

    const q = this.searchTerm.toLowerCase().trim();
    return this.commandes.filter(c =>
      (c.id && c.id.toLowerCase().includes(q)) ||
      ((c as any).nomDestinataire && String((c as any).nomDestinataire).toLowerCase().includes(q)) ||
      (c.adresseArriveeId && c.adresseArriveeId.toLowerCase().includes(q)) ||
      (c.statut && c.statut.toLowerCase().includes(q)) ||
      ((c as any).telephone && String((c as any).telephone).includes(q))
    );
  }

  onDashboardSearch(): void {
    if (!this.searchTerm?.trim()) {
      this.searchResult = null;
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.apiService.searchCommandes(this.searchTerm).subscribe({
      next: (results) => {
        console.log('Résultats de recherche:', results);
        this.searchResult = results?.[0] || null;
        this.loading = false;
        if (!this.searchResult) {
          this.errorMessage = 'Aucun résultat trouvé pour : ' + this.searchTerm;
        }
      },
      error: (err) => {
        console.error('Erreur de recherche détaillée:', err);
        console.error('Status:', err.status);
        console.error('Message:', err.message);
        console.error('Error object:', err.error);
        this.errorMessage =
          'Erreur lors de la recherche : ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.searchResult = null;
        this.loading = false;
      }
    });
  }

  getStatusLabel(statut: string): string {
    const found = this.detailedStatuses.find(s => s.key === statut);
    return found ? found.label : statut;
  }

  isStatusReached(targetStatus: string, currentStatus: string): boolean {
    const statusOrder = [
      'EN_ATTENTE',
      'MANIFESTE',
      'A_ENLEVER',
      'ENLEVE',
      'AU_DEPOT',
      'EN_LIVRAISON',
      'LIVRE',
      'LIVRE_PAYE'
    ];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const targetIndex = statusOrder.indexOf(targetStatus);
    if (currentIndex === -1 || targetIndex === -1) return false;
    return currentIndex >= targetIndex;
  }

  getStatusClass(statut: string | undefined): string {
    return `status-${(statut || 'EN_ATTENTE').toLowerCase()}`;
  }

  viewOrderDetails(cmd: Commande): void {
    this.searchResult = cmd;
    this.setTab('rechercher');
  }

  // ========== RÉCLAMATIONS ==========
  ajouterReclamation(): void {
    if (this.reclamationForm.invalid) {
      this.markFormGroupTouched(this.reclamationForm);
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const formValue = this.reclamationForm.value;

    const reclamation: any = {
      clientId: this.clientId,
      commandeId: formValue.codeBarre.trim(),
      type: formValue.objet,
      description: formValue.description?.trim() || '',
      statut: 'EN_ATTENTE'
    };

    this.apiService.creerReclamation(reclamation).subscribe({
      next: () => {
        this.loading = false;
        this.reclamationSuccessMsg = 'Réclamation envoyée avec succès.';
        this.reclamationForm.reset();
        this.loadReclamations();
        setTimeout(() => (this.reclamationSuccessMsg = ''), 5000);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Erreur lors de l’envoi de la réclamation.';
      }
    });
  }

  getClaimIcon(objet: string): string {
    const iconMap: { [key: string]: string } = {
      'Colis perdu': '📦',
      'Colis endommagé': '🔨',
      'Retard de livraison': '⏰',
      'Erreur de livraison': '🚫',
      'Problème de paiement': '💳',
      'Autre': '❓'
    };
    return iconMap[objet] || '📝';
  }

  getReclamationStatusLabel(statut: string): string {
    const labelMap: { [key: string]: string } = {
      'EN_ATTENTE': '⏳ En attente',
      'EN_COURS': '🔄 En cours',
      'RESOLUE': '✅ Résolue',
      'FERMEE': '🔒 Fermée'
    };
    return labelMap[statut] || statut;
  }

  getResolvedReclamationsCount(): number {
    return this.reclamationsList.filter(r => r.statut === 'RESOLUE').length;
  }

  getFilteredReclamations(): any[] {
    if (this.reclamationFilter === 'ALL') {
      return this.reclamationsList;
    }
    return this.reclamationsList.filter(r => r.statut === this.reclamationFilter);
  }

  setReclamationFilter(filter: string): void {
    this.reclamationFilter = filter;
  }

  openReclamationDetails(reclamation: any): void {
    // Rafraîchir les données avant d'ouvrir les détails
    this.loadReclamations();
    this.selectedReclamation = reclamation;
    this.showReclamationDetails = true;
    // Garder la sidebar ouverte pour permettre de voir les détails par-dessus
    // showReclamationsSidebar reste inchangé
  }

  closeReclamationDetails(): void {
    this.showReclamationDetails = false;
    this.selectedReclamation = null;
  }

  // ========== SIDEBAR RÉCLAMATIONS ==========
  openReclamationsSidebar(): void {
    this.loadReclamations();
    this.showReclamationsSidebar = true;
  }

  closeReclamationsSidebar(): void {
    this.showReclamationsSidebar = false;
  }

  getFilteredSidebarReclamations(): any[] {
    if (this.reclamationsSidebarFilter === 'ALL') {
      return this.reclamationsList;
    }
    return this.reclamationsList.filter(r => r.statut === this.reclamationsSidebarFilter);
  }

  setReclamationsSidebarFilter(filter: string): void {
    this.reclamationsSidebarFilter = filter;
  }

  hasAdminResponse(reclamation: any): boolean {
    return !!(reclamation.reponseAdmin && reclamation.reponseAdmin.trim());
  }

  selectReclamationForResponse(reclamation: any): void {
    this.selectedSidebarReclamation = reclamation;
  }

  closeSidebarResponse(): void {
    this.selectedSidebarReclamation = null;
  }

  // ========== SERVICE CLIENT ==========
  contactMember(member: TeamMember): void {
    console.log('Contacter', member.nom, member.tel);
  }

  callMember(member: TeamMember): void {
    window.open(`tel:${member.tel}`, '_self');
  }

  // ========== SERVICE CLIENT ENHANCEMENTS ==========
  updateServiceStats(): void {
    this.serviceStats.totalMembers = this.teamMembers.length;
    this.serviceStats.available = this.teamMembers.filter(m => m.disponibility === 'DISPONIBLE').length;
    this.serviceStats.inCall = this.teamMembers.filter(m => m.disponibility === 'EN_APPEL').length;
    this.serviceStats.absent = this.teamMembers.filter(m => m.disponibility === 'ABSENT').length;
  }

  getAvailabilityClass(disponibility: string): string {
    switch (disponibility) {
      case 'DISPONIBLE': return 'available';
      case 'EN_APPEL': return 'in-call';
      case 'ABSENT': return 'absent';
      case 'DEJEUNE': return 'away';
      default: return 'unknown';
    }
  }

  getAvailabilityLabel(disponibility: string): string {
    switch (disponibility) {
      case 'DISPONIBLE': return 'Disponible';
      case 'EN_APPEL': return 'En appel';
      case 'ABSENT': return 'Absent';
      case 'DEJEUNE': return 'En pause';
      default: return 'Inconnu';
    }
  }

  toggleFavorite(member: TeamMember): void {
    member.isFavorite = !member.isFavorite;
    this.successMessage = member.isFavorite ? `${member.nom} ajouté aux favoris` : `${member.nom} retiré des favoris`;
    setTimeout(() => this.successMessage = '', 3000);
  }

  openMemberDetail(member: TeamMember): void {
    this.selectedMember = member;
    this.showMemberDetail = true;
    this.memberNotes = member.notes || '';
  }

  closeMemberDetail(): void {
    this.showMemberDetail = false;
    this.selectedMember = null;
  }

  saveMemberNotes(): void {
    if (this.selectedMember) {
      this.selectedMember.notes = this.memberNotes;
      this.successMessage = 'Notes sauvegardées';
      setTimeout(() => this.successMessage = '', 3000);
    }
  }

  openRdvModal(member: TeamMember): void {
    this.selectedMember = member;
    this.showRdvModal = true;
  }

  closeRdvModal(): void {
    this.showRdvModal = false;
    this.selectedMember = null;
  }

  scheduleRdv(date: string, time: string): void {
    if (this.selectedMember) {
      this.successMessage = `RDV programmé avec ${this.selectedMember.nom} le ${date} à ${time}`;
      this.closeRdvModal();
      setTimeout(() => this.successMessage = '', 3000);
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    const toast: ToastMessage = {
      id: this.toastIdCounter++,
      message,
      type
    };
    this.toasts.push(toast);
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== toast.id);
    }, 5000);
  }
}