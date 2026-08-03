import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApiService, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

export interface Reclamation {
  id?: string;
  objet: string;
  codeBarre: string;
  description: string;
  dateCreation: Date;
  statut: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard-enhanced.component.html',
  styleUrls: ['./dashboard-enhanced.component.scss']
})
export class DashboardComponent implements OnInit {
  clientName = 'Client';
  clientId = '';
  commandes: Commande[] = [];
  pendingCommandes: Commande[] = [];

  activeTab = 'dashboard';
  isConnected = true;

  // Stats Grid matching exact screenshot requirements
  nonSerieuxCount = 0;
  enAttenteCount = 0;
  aEnleverCount = 0;
  enlevesCount = 0;
  auDepotCount = 4;
  retourDepotCount = 0;
  enCoursCount = 0;
  aVerifierCount = 0;
  livreeCount = 0;
  livresPayesTotal = 0;
  echangesCount = 0;
  remboursesCount = 0;
  retourDefinitifCount = 0;
  retourInterAgenceCount = 0;
  retourExpediteursCount = 0;
  retourRecuCount = 0;

  // Search filter inside table
  searchTerm = '';

  // Reactive Form for adding package
  packageForm: FormGroup;

  // Paiements tab fields
  month = 'Juillet';
  year = '2026';
  months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  years = ['2024', '2025', '2026', '2027', '2028'];

  // New Reclamation form fields
  reclamationForm: FormGroup;
  reclamationsList: Reclamation[] = [];
  reclamationSuccessMsg = '';

  // Team list for Service Client
  teamMembers = [
    { initials: 'FB', nom: 'Farid Bouzouita', poste: 'Service Client', tel: '+216 98 218 003' },
    { initials: 'DB', nom: 'Donia Bouzouita', poste: 'Service Client', tel: '+216 57 178 469' },
    { initials: 'CB', nom: 'Chirine Bouzouita', poste: 'Service Client', tel: '+216 57 178 491' }
  ];

  // Options for Object drop-down matching screenshot 2
  objetOptions = [
    'Retard de livraison',
    'Colis perdu',
    'Échange non reçu',
    'Retour non reçu',
    'Colis endommagé',
    'Colis non payé',
    'Paiement non reçu',
    'Manque paiement',
    'Chèque non reçu'
  ];

  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {
    // Initialize reactive forms
    this.packageForm = this.fb.group({
      pickupName: ['', [Validators.required, Validators.minLength(3)]],
      governorate: ['', Validators.required],
      city: ['', [Validators.required, Validators.minLength(2)]],
      locality: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10)]],
      phone1: ['', [Validators.required, Validators.pattern(/^[0-9+ ]{8,15}$/)]],
      phone2: ['', [Validators.pattern(/^[0-9+ ]{8,15}$/)]],
      designation: ['', [Validators.required, Validators.minLength(5)]],
      price: ['', [Validators.required, Validators.min(0)]],
      itemCount: ['', [Validators.required, Validators.min(1)]],
      packageCount: ['', [Validators.required, Validators.min(1)]],
      paymentMode: ['Espèce seulement', Validators.required],
      openBeforePayment: ['Non', Validators.required],
      exchange: ['Non', Validators.required],
      typeService: ['STANDARD', Validators.required],
      remarks: ['', Validators.maxLength(500)]
    });

    this.reclamationForm = this.fb.group({
      objet: ['', Validators.required],
      codeBarre: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.maxLength(1000)]]
    });
  }

  ongoingOrder?: Commande;

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clientName = `${user.prenom} ${user.nom}`;
      this.clientId = user.id;
      this.loadClientCommandes();
    }
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  verifyClient(): void {
    this.errorMessage = '';
    alert('Vérification client non implémentée pour l\'instant.');
  }

  submitPickup(): void {
    if (this.packageForm.invalid) {
      this.markFormGroupTouched(this.packageForm);
      this.errorMessage = 'Veuillez corriger les erreurs dans le formulaire.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const user = this.authService.getCurrentUser();
    const clientId = user ? user.id : 'client-default-id';

    const formValue = this.packageForm.value;
    const commande: Commande = {
      clientId,
      adresseDepartId: 'adresse-depart-default-id',
      adresseArriveeId: 'adresse-arrivee-default-id',
      statut: 'EN_ATTENTE',
      typeService: formValue.typeService,
      montantTotal: parseFloat(formValue.price) || 25.0
    };

    this.apiService.creerCommande(commande).subscribe({
      next: () => {
        this.loading = false;
        alert('Colis ajouté avec succès !');
        this.packageForm.reset();
        this.loadClientCommandes();
        this.setTab('dashboard');
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Erreur lors de l\'ajout du colis.';
      }
    });
  }

  // Helper method to mark all form controls as touched
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  toggleConnection(): void {
    this.isConnected = !this.isConnected;
  }

  validatePayments(): void {
    alert(`Paiements filtrés pour ${this.month} ${this.year}`);
  }

  loadClientCommandes(): void {
    if (!this.clientId) return;

    this.apiService.getCommandesByClient(this.clientId).subscribe({
      next: (res: Commande[]) => {
        this.commandes = res;
        this.pendingCommandes = res.filter((c: Commande) => c.statut === 'EN_ATTENTE' || c.statut === 'VALIDEE');
        this.ongoingOrder = res.find((c: Commande) => c.statut === 'EN_LIVRAISON');
        this.calculateStats();
      },
      error: (err: Error) => console.error('Error loading client orders:', err)
    });
  }

  calculateStats(): void {
    this.enAttenteCount = this.commandes.filter(c => c.statut === 'EN_ATTENTE').length;
    this.aEnleverCount = this.commandes.filter(c => c.statut === 'VALIDEE').length;
    this.enCoursCount = this.commandes.filter(c => c.statut === 'EN_LIVRAISON').length;
    this.livreeCount = this.commandes.filter(c => c.statut === 'LIVREE').length;
    
    // Total montant des livrés payés
    this.livresPayesTotal = this.commandes
      .filter(c => c.statut === 'LIVREE')
      .reduce((sum, c) => sum + (c.montantTotal || 0), 0);
  }

  calculateRetourRate(): number {
    const total = this.commandes.length;
    if (total === 0) {
      return 0;
    }

    const retourStatuses = [
      'RETOUR_DEPOT',
      'RETOUR_DEFINITIF',
      'RETOUR_INTER_AGENCE',
      'RETOUR_EXPEDITEURS',
      'RETOUR_RECU'
    ];

    const totalRetours = this.commandes.filter(c => retourStatuses.includes(c.statut)).length;
    return Math.round((totalRetours / total) * 100);
  }

  ajouterReclamation(): void {
    if (this.reclamationForm.invalid) {
      this.markFormGroupTouched(this.reclamationForm);
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const formValue = this.reclamationForm.value;
    const newRec: Reclamation = {
      id: 'REC-' + Math.floor(1000 + Math.random() * 9000),
      objet: formValue.objet,
      codeBarre: formValue.codeBarre,
      description: formValue.description,
      dateCreation: new Date(),
      statut: 'En cours de traitement'
    };

    this.reclamationsList.unshift(newRec);
    this.reclamationSuccessMsg = 'Réclamation ajoutée avec succès ! Notre équipe la traite dans les plus brefs délais.';
    
    // Reset form
    this.reclamationForm.reset();

    setTimeout(() => this.reclamationSuccessMsg = '', 5000);
  }

  validerManifeste(): void {
    if (this.pendingCommandes.length === 0) {
      alert('Aucun colis en attente à valider dans le manifeste.');
      return;
    }

    let completed = 0;
    this.pendingCommandes.forEach(cmd => {
      if (cmd.id) {
        this.apiService.updateCommandeStatut(cmd.id, 'EN_LIVRAISON').subscribe({
          next: () => {
            completed++;
            if (completed === this.pendingCommandes.length) {
              alert('Manifeste validé avec succès ! Tous vos colis en attente sont maintenant sortis en cours de livraison.');
              this.loadClientCommandes();
            }
          }
        });
      }
    });
  }

  imprimerManifeste(): void {
    window.print();
  }

  get filteredPendingCommandes(): Commande[] {
    if (!this.searchTerm) return this.pendingCommandes;
    return this.pendingCommandes.filter(c => 
      (c.id && c.id.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (c.adresseArriveeId && c.adresseArriveeId.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  onDashboardSearch(): void {
    // placeholder function for dashboard search
    console.log('Searching for:', this.searchTerm);
  }

  // Form getters for validation
  get f() { return this.packageForm.controls; }
  get r() { return this.reclamationForm.controls; }

  // Helper methods for template
  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString('fr-FR');
  }
}
