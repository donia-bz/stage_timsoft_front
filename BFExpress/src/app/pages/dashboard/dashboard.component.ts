import { Component, OnInit } from '@angular/core';
import { ApiService, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

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
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
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

  // Add parcel form fields
  pickupName = '';
  governorate = '';
  city = '';
  locality = '';
  address = '';
  phone1 = '';
  phone2 = '';
  designation = '';
  price = '25.0';
  itemCount = 1;
  packageCount = 1;
  paymentMode = 'Espèce seulement';
  openBeforePayment = 'Non';
  exchange = 'Non';
  typeService = 'STANDARD';
  remarks = '';
  loading = false;
  errorMessage = '';

  // Paiements tab fields
  month = 'Juillet';
  year = '2026';
  months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  years = ['2024', '2025', '2026', '2027', '2028'];

  // New Reclamation form fields
  reclamationObjet = '';
  reclamationCodeBarre = '';
  reclamationDescription = '';
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

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

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

  verifyClient(): void {
    this.errorMessage = '';
    alert('Vérification client non implémentée pour l’instant.');
  }

  submitPickup(): void {
    if (!this.city || !this.address || !this.phone1 || !this.designation) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires (Ville, Adresse, Téléphone, Désignation).';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const user = this.authService.getCurrentUser();
    const clientId = user ? user.id : 'client-default-id';

    const commande: Commande = {
      clientId,
      adresseDepartId: 'adresse-depart-default-id',
      adresseArriveeId: 'adresse-arrivee-default-id',
      statut: 'EN_ATTENTE',
      typeService: this.typeService,
      montantTotal: parseFloat(this.price) || 25.0
    };

    this.apiService.creerCommande(commande).subscribe({
      next: () => {
        this.loading = false;
        alert('Colis ajouté avec succès !');
        this.loadClientCommandes();
        this.setTab('dashboard');
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Erreur lors de l’ajout du colis.';
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
      next: (res) => {
        this.commandes = res;
        this.pendingCommandes = res.filter(c => c.statut === 'EN_ATTENTE' || c.statut === 'VALIDEE');
        this.ongoingOrder = res.find(c => c.statut === 'EN_LIVRAISON');
        this.calculateStats();
      },
      error: (err) => console.error('Error loading client orders:', err)
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
    if (!this.reclamationObjet || !this.reclamationCodeBarre) {
      alert('Veuillez sélectionner un objet et saisir le code à barre / référence du colis.');
      return;
    }

    const newRec: Reclamation = {
      id: 'REC-' + Math.floor(1000 + Math.random() * 9000),
      objet: this.reclamationObjet,
      codeBarre: this.reclamationCodeBarre,
      description: this.reclamationDescription,
      dateCreation: new Date(),
      statut: 'En cours de traitement'
    };

    this.reclamationsList.unshift(newRec);
    this.reclamationSuccessMsg = 'Réclamation ajoutée avec succès ! Notre équipe la traite dans les plus brefs délais.';
    
    // Reset form
    this.reclamationObjet = '';
    this.reclamationCodeBarre = '';
    this.reclamationDescription = '';

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
    // placeholder function for dashboard search logic
    alert(`Recherche du colis : ${this.searchTerm}`);
  }
}
