import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApiService, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

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
}

@Component({
  selector: 'app-dashboard-client',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard-client.component.html',
  styleUrls: ['./dashboard-client.component.scss']
})
export class DashboardClientComponent implements OnInit {

  activeTab = 'dashboard';
  clientName = 'Client';
  clientId = '';

  commandes: Commande[] = [];
  pendingCommandes: Commande[] = [];
  validatedManifests: any[] = [];
  reclamationsList: Reclamation[] = [];

  searchTerm = '';
  searchResult: Commande | null = null;
  showManifestHistory = false;

  loading = false;
  errorMessage = '';
  reclamationSuccessMsg = '';

  month = 'Août';
  year = '2026';
  months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  years = ['2024', '2025', '2026', '2027', '2028'];

  packageForm!: FormGroup;
  reclamationForm!: FormGroup;
  echangeForm!: FormGroup;

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
      bio: 'Spécialiste des réclamations et du suivi des livraisons.'
    },
    {
      initials: 'DB',
      nom: 'Donia Bouzouita',
      poste: 'Service Client',
      tel: '+216 57 178 469',
      rating: 4.8,
      bio: 'Accompagnement des clients professionnels et gestion des retours.'
    },
    {
      initials: 'CB',
      nom: 'Chirine Bouzouita',
      poste: 'Service Client',
      tel: '+216 57 178 491',
      rating: 4.7,
      bio: 'Support technique et assistance pour les nouveaux clients.'
    }
  ];

  // Statuts type First Delivery / Navex
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
    private router: Router
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clientName = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Client';
      this.clientId = user.id; // Utiliser l'ID de l'utilisateur comme clientId
      console.log('Utilisateur connecté:', user);
      console.log('Client ID utilisé:', this.clientId);
      this.loadClientCommandes();
      this.loadReclamations();
      this.loadManifests();
    } else {
      console.error('Aucun utilisateur connecté');
    }
  }

  loadManifests(): void {
    if (!this.clientId) return;
    this.apiService.getManifestesByClient(this.clientId).subscribe({
      next: (res) => {
        // Filtrer pour ne garder que ceux qui ne sont pas en brouillon si nécessaire
        this.validatedManifests = res.filter(m => m.statut !== 'BROUILLON') || [];
      },
      error: (err) => {
        console.error('Erreur chargement manifestes:', err);
      }
    });
  }

  private initForms(): void {
    this.packageForm = this.fb.group({
      pickupName: ['Client Test', [Validators.required, Validators.minLength(3)]],
      governorate: ['Tunis', Validators.required],
      city: ['Tunis', [Validators.required, Validators.minLength(2)]],
      locality: ['Centre', Validators.required],
      address: ['123 Avenue Habib Bourguiba, Tunis', [Validators.required, Validators.minLength(10)]],
      phone1: ['+216 98 123 456', [Validators.required, Validators.pattern(/^[0-9+ ]{8,15}$/)]],
      phone2: ['', [Validators.pattern(/^[0-9+ ]{8,15}$/)]],
      designation: ['Colis test', [Validators.required, Validators.minLength(5)]],
      price: [50, [Validators.min(0)]], // Prix par défaut 50
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

    this.echangeForm = this.fb.group({
      ancienColisId: ['', Validators.required],
      nouveauNom: ['', [Validators.required, Validators.minLength(3)]],
      nouveauPhone: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{8,15}$/)]],
      nouveauGouvernorat: ['', Validators.required],
      nouveauVille: ['', Validators.required],
      nouveauLocalite: ['', Validators.required],
      nouveauAdresse: ['', Validators.required],
      nouveauPrix: [null, [Validators.required, Validators.min(0)]]
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
        // Seules les commandes EN_ATTENTE peuvent être mises sur manifeste
        this.pendingCommandes = this.commandes.filter(
          c => c.statut === 'EN_ATTENTE'
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement commandes client:', err);
        this.errorMessage = 'Erreur lors du chargement des commandes';
        this.commandes = [];
        this.pendingCommandes = [];
        this.loading = false;
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
    if (rate < 10) return '✓ Excellent — En dessous de l\'objectif (< 10%)';
    if (rate < 20) return '⚠ Attention — Proche de la limite';
    return '❌ Critique — Au-dessus de l\'objectif';
  }

  filterByStatus(status: string): void {
    this.searchTerm = status;
    this.setTab('mes-commandes');
  }

  // ========== BORDEREAU DE RÈGLEMENT ==========
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
    const anneeNum = parseInt(this.year);

    this.loading = true;
    this.apiService.getReglementsByClient(this.clientId, moisIndex, anneeNum).subscribe({
      next: (paiements: any[]) => {
        // Utiliser les données backend pour les calculs
        const totalCOD = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
        const totalFrais = paiements.reduce((sum, p) => sum + (p.frais || 0), 0);
        const totalNet = paiements.reduce((sum, p) => sum + (p.net || 0), 0);

        console.log('Règlements chargés:', {
          mois: this.month,
          annee: this.year,
          totalCOD,
          totalFrais,
          totalNet,
          nombrePaiements: paiements.length
        });

        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement règlements:', err);
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

  // ========== FORMS HELPERS ==========
  isInvalid(controlName: string, form: FormGroup = this.packageForm): boolean {
    const control = form.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getError(controlName: string, form: FormGroup = this.packageForm): string {
    const control = form.get(controlName);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Ce champ est obligatoire';
    if (control.errors['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} caractères`;
    if (control.errors['maxlength']) return `Maximum ${control.errors['maxlength'].requiredLength} caractères`;
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

    // Créer la commande
    const commande: any = {
      clientId: this.clientId,
      typeService: formValue.typeService,
      montantTotal: formValue.price || 0,
      nomDestinataire: formValue.pickupName,
      telephoneDestinataire: formValue.phone1,
      colis: [{
        destinataireId: null,
        clientId: this.clientId,
        poids: 1.0,
        fragile: false,
        statut: 'EN_ATTENTE'
      }]
    };

    console.log('Envoi de la commande:', commande);
    console.log('Client ID utilisé pour création:', this.clientId);

    this.apiService.creerCommande(commande).subscribe({
      next: (cmd) => {
        console.log('Commande créée avec succès:', cmd);
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
        console.error('Erreur création commande:', err);
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Erreur lors de la création de la commande.';
      }
    });
  }

  // ========== MANIFESTE ==========
  calculateManifestTotal(): number {
    return this.pendingCommandes.reduce(
      (sum, c) => sum + (c.montantTotal || (c as any).prix || 0), 0
    );
  }

  validerEtImprimerManifest(): void {
    if (this.pendingCommandes.length === 0) {
      this.errorMessage = 'Aucun colis en attente à valider.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    // Créer le manifeste avec les colis en attente
    // On utilise les IDs des commandes, le backend convertira en IDs de colis
    const manifeste = {
      clientId: this.clientId,
      nombreColis: this.pendingCommandes.length,
      commandeIds: this.pendingCommandes.map(c => c.id).filter(id => id), // Envoyer les IDs de commandes
      statut: 'BROUILLON'
    };

    this.apiService.creerManifeste(manifeste).subscribe({
      next: (manifest) => {
        // Valider le manifeste - le backend mettra automatiquement les colis à A_ENLEVER
        this.apiService.validerManifeste(manifest.id).subscribe({
          next: () => {
            this.loading = false;
            this.loadClientCommandes();
            this.errorMessage = '';
            this.validatedManifests.push(manifest);
          },
          error: (err) => {
            this.loading = false;
            this.errorMessage = 'Erreur lors de la validation du manifeste.';
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Erreur lors de la création du manifeste.';
      }
    });
  }

  removeFromManifest(cmd: Commande): void {
    this.pendingCommandes = this.pendingCommandes.filter(c => c.id !== cmd.id);
  }

  imprimerEtiquette(cmd: Commande): void {
    window.print();
  }

  reprintManifest(manifest: any): void {
    window.print();
  }

  // ========== RECHERCHE ==========
  get filteredCommandes(): Commande[] {
    if (!this.searchTerm?.trim()) return this.commandes;
    const q = this.searchTerm.toLowerCase().trim();
    return this.commandes.filter(c =>
      (c.id && c.id.toLowerCase().includes(q)) ||
      ((c as any).nomDestinataire && (c as any).nomDestinataire.toLowerCase().includes(q)) ||
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
    console.log('Recherche en cours pour:', this.searchTerm);

    this.apiService.searchCommandes(this.searchTerm).subscribe({
      next: (results) => {
        console.log('Résultats de recherche:', results);
        this.searchResult = results[0] || null;
        this.loading = false;
        if (!this.searchResult) {
          this.errorMessage = 'Aucun résultat trouvé pour: ' + this.searchTerm;
        }
      },
      error: (err) => {
        console.error('Erreur recherche:', err);
        this.errorMessage = 'Erreur lors de la recherche: ' + (err.message || err.error?.message || 'Erreur inconnue');
        this.searchResult = null;
        this.loading = false;
      }
    });
  }

  getStatusLabel(statut: string): string {
    const status = this.detailedStatuses.find(s => s.key === statut);
    return status ? status.label : statut;
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

    return currentIndex >= targetIndex;
  }

  getStatusClass(statut: string | undefined): string {
    return `status-${statut?.toLowerCase() || 'en_attente'}`;
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
      commandeId: formValue.codeBarre.trim(), // Utiliser codeBarre comme commandeId pour simplifier
      type: formValue.objet,
      description: formValue.description?.trim() || '',
      statut: 'EN_ATTENTE'
    };

    this.apiService.creerReclamation(reclamation).subscribe({
      next: (rec) => {
        this.loading = false;
        this.reclamationSuccessMsg = 'Réclamation envoyée avec succès.';
        this.reclamationForm.reset();
        this.loadReclamations();
        setTimeout(() => this.reclamationSuccessMsg = '', 5000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Erreur lors de l\'envoi de la réclamation.';
      }
    });
  }

  loadReclamations(): void {
    if (!this.clientId) return;

    this.apiService.getReclamationsByClient(this.clientId).subscribe({
      next: (reclamations) => {
        this.reclamationsList = reclamations.map(r => ({
          id: r.id,
          objet: r.type,
          codeBarre: r.commandeId,
          description: r.description,
          dateCreation: r.dateCreation,
          statut: r.statut
        }));
      },
      error: (err) => {
        console.error('Erreur chargement réclamations:', err);
      }
    });
  }

  // ========== ÉCHANGE ==========
  validerEchange(): void {
    if (this.echangeForm.invalid) {
      this.markFormGroupTouched(this.echangeForm);
      return;
    }
    this.echangeForm.reset();
    this.setTab('mes-commandes');
  }

  resetEchangeForm(): void {
    this.echangeForm.reset();
  }

  // ========== SERVICE CLIENT ==========
  contactMember(member: TeamMember): void {
    console.log('Contacter', member.nom, member.tel);
  }

  callMember(member: TeamMember): void {
    window.open(`tel:${member.tel}`, '_self');
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-TN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}