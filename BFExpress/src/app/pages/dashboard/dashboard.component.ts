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

  activeTab: string = 'dashboard';

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

  // New Reclamation form fields
  reclamationObjet = '';
  reclamationCodeBarre = '';
  reclamationDescription = '';
  reclamationsList: Reclamation[] = [];
  reclamationSuccessMsg = '';

  // Team list for Service Client
  teamMembers = [
    { initials: 'WA', nom: 'Wajdi Dridi', poste: 'Responsable Service Client', tel: '+216 20 233 750' },
    { initials: 'EY', nom: 'Eya Labreg', poste: 'Chargée Clientèle', tel: '+216 31 262 626' },
    { initials: 'NO', nom: 'Nourchen Slaimi', poste: 'Assistance Livraison', tel: '+216 27 327 754' },
    { initials: 'AM', nom: 'Amine Agrebi', poste: 'Support Technique', tel: '+216 57 037 637' }
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

  loadClientCommandes(): void {
    if (!this.clientId) return;

    this.apiService.getCommandesByClient(this.clientId).subscribe({
      next: (res) => {
        this.commandes = res;
        this.pendingCommandes = res.filter(c => c.statut === 'EN_ATTENTE' || c.statut === 'VALIDEE');
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
      (c.adresseArrivee.ville && c.adresseArrivee.ville.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }
}
