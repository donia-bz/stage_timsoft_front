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
      this.clientId = user.id;
      this.loadClientCommandes();
      this.loadReclamations();
      this.loadManifests();
    }
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

  loadManifests(): void {
    if (!this.clientId) return;

    this.apiService.getManifestesByClient(this.clientId).subscribe({
      next: (res) => {
        this.validatedManifests = (res || []).filter((m: any) => m.statut !== 'BROUILLON');
      },
      error: (err) => console.error('Erreur chargement manifestes:', err)
    });
  }

  loadReclamations(): void {
    if (!this.clientId) return;

    this.apiService.getReclamationsByClient(this.clientId).subscribe({
      next: (reclamations) => {
        this.reclamationsList = (reclamations || []).map((r: any) => ({
          id: r.id,
          objet: r.type || r.objet,
          codeBarre: r.commandeId || r.codeBarre,
          description: r.description,
          dateCreation: r.dateCreation,
          statut: r.statut
        }));
      },
      error: (err) => console.error('Erreur chargement réclamations:', err)
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

    const commande: any = {
      clientId: this.clientId,
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
      nombreColis: this.pendingCommandes.length,
      commandeIds: this.pendingCommandes.map(c => c.id).filter(id => !!id),
      statut: 'BROUILLON'
    };

    this.apiService.creerManifeste(manifeste).subscribe({
      next: (manifest) => {
        this.apiService.validerManifeste(manifest.id).subscribe({
          next: () => {
            this.loading = false;
            this.loadClientCommandes();
            this.loadManifests();
            this.errorMessage = '';
          },
          error: () => {
            this.loading = false;
            this.errorMessage = 'Erreur lors de la validation du manifeste.';
          }
        });
      },
      error: () => {
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}