import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, Commande, Reclamation } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

interface Manifeste {
  id?: string;
  clientId: string;
  nombreColis: number;
  statut: string;
  colisIds?: string[];
  dateCreation?: string;
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
  currentManifeste: Manifeste | null = null;
  validatedManifests: Manifeste[] = [];
  addresses: any[] = [];
  unreadNotifications = 0;
  currentDate: Date = new Date();

  activeTab = 'dashboard';
  isConnected = true;
  showAddAddress = false;
  showSidebarMenu = false;
  showManifestHistory = false;

  // Search filter inside table
  searchTerm = '';
  searchResult: Commande | null = null;

  // Reactive Form for adding package
  packageForm: FormGroup;
  profileForm: FormGroup;
  echangeForm: FormGroup;

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
    { 
      initials: 'FB', 
      nom: 'Farid Bouzouita', 
      poste: 'Service Client', 
      tel: '+216 98 218 003',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
      rating: 4.9,
      bio: 'Expert en logistique avec 5 ans d\'expérience. Spécialisé dans la résolution de problèmes complexes.'
    },
    { 
      initials: 'DB', 
      nom: 'Dalila Ben Salem', 
      poste: 'Support Technique', 
      tel: '+216 71 234 567',
      photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
      rating: 4.8,
      bio: 'Spécialiste en gestion des réclamations et satisfaction client.'
    },
    { 
      initials: 'KM', 
      nom: 'Khaled Mourad', 
      poste: 'Logistique', 
      tel: '+216 55 123 456',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
      rating: 4.7,
      bio: 'Coordinateur de livraisons et optimisation des itinéraires.'
    }
  ];

  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {
    // Initialize reactive forms with NO validations for testing
    this.packageForm = this.fb.group({
      pickupName: [''],
      governorate: [''],
      city: [''],
      locality: [''],
      address: [''],
      phone1: [''],
      phone2: [''],
      designation: [''],
      price: [''],
      itemCount: [''],
      packageCount: [''],
      paymentMode: ['Espèce seulement'],
      openBeforePayment: ['Non'],
      exchange: ['Non'],
      typeService: ['STANDARD'],
      remarks: ['']
    });

    this.reclamationForm = this.fb.group({
      objet: ['', Validators.required],
      codeBarre: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.maxLength(1000)]]
    });

    this.profileForm = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      entreprise: ['']
    });

    this.echangeForm = this.fb.group({
      ancienColisId: ['', Validators.required],
      nouveauNom: ['', Validators.required],
      nouveauPhone: ['', Validators.required],
      nouveauGouvernorat: ['', Validators.required],
      nouveauVille: ['', Validators.required],
      nouveauLocalite: ['', Validators.required],
      nouveauAdresse: ['', Validators.required],
      nouveauPrix: ['', Validators.required]
    });
  }

  ongoingOrder?: Commande;

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clientName = user.nom || 'Client';
      this.clientId = user.id || 'client-default-id';
    }
    this.loadClientCommandes();
    this.loadReclamations();
  }

  loadReclamations(): void {
    this.apiService.getAllReclamations().subscribe({
      next: (reclamations: any[]) => {
        this.reclamationsList = reclamations;
      },
      error: (err: Error) => {
        console.error('Erreur chargement réclamations:', err);
      }
    });
  }

  loadClientCommandes(): void {
    this.apiService.getAllCommandes().subscribe({
      next: (commandes: Commande[]) => {
        this.commandes = commandes;
        this.pendingCommandes = commandes.filter(c => c.statut === 'EN_ATTENTE');
      },
      error: (err: Error) => {
        console.error('Erreur chargement commandes:', err);
        this.errorMessage = 'Erreur lors du chargement des commandes';
      }
    });
  }

  addCommandToManifest(): void {
    console.log('Bouton Ajouter cliqué');

    const formValue = this.packageForm.value;
    console.log('Valeurs formulaire:', formValue);

    // Générer un ID unique pour la commande
    const uniqueId = 'CMD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const user = this.authService.getCurrentUser();
    const clientId = user ? user.id : 'client-default-id';

    const createdCmd: Commande = {
      id: uniqueId,
      clientId,
      adresseDepartId: 'adresse-depart-default-id',
      adresseArriveeId: formValue.address,
      statut: 'EN_ATTENTE',
      dateCreation: new Date().toISOString(),
      montantTotal: parseFloat(formValue.price) || 0,
      nomDestinataire: formValue.pickupName,
      telephone: formValue.phone1,
      typeService: formValue.typeService,
      codeBarre: uniqueId
    };

    console.log('Commande créée:', createdCmd);

    // Si un manifeste existe déjà, ajouter à ce manifeste
    if (this.currentManifeste && this.currentManifeste.id) {
      const updatedManifeste = {
        ...this.currentManifeste,
        nombreColis: this.currentManifeste.nombreColis + 1,
        colisIds: [...(this.currentManifeste.colisIds || []), uniqueId]
      };

      this.apiService.updateManifeste(this.currentManifeste.id, updatedManifeste).subscribe({
        next: (updatedManifeste: Manifeste) => {
          console.log('Manifeste mis à jour dans MongoDB:', updatedManifeste);
          this.currentManifeste = updatedManifeste;
          this.pendingCommandes.push(createdCmd);
          this.commandes.push(createdCmd); // Ajouter à mes commandes
          this.packageForm.reset();
          alert(`Commande ajoutée au manifest !\nID: ${createdCmd.id}\nStatut: EN_ATTENTE\n✅ Stockée dans MongoDB`);
        },
        error: (err: Error) => {
          console.error('Erreur mise à jour manifeste:', err);
          this.errorMessage = 'Erreur lors de l\'ajout au manifest: ' + err.message;
        }
      });
    } else {
      // Créer un nouveau manifeste
      const newManifeste: Manifeste = {
        clientId,
        nombreColis: 1,
        statut: 'EN_COURS',
        colisIds: [uniqueId],
        dateCreation: new Date().toISOString()
      };

      this.apiService.creerManifeste(newManifeste).subscribe({
        next: (createdManifeste: Manifeste) => {
          console.log('Nouveau manifeste créé dans MongoDB:', createdManifeste);
          this.currentManifeste = createdManifeste;
          this.pendingCommandes.push(createdCmd);
          this.commandes.push(createdCmd); // Ajouter à mes commandes
          this.packageForm.reset();
          alert(`Commande ajoutée au manifest !\nID: ${createdCmd.id}\nStatut: EN_ATTENTE\n✅ Stockée dans MongoDB`);
        },
        error: (err: Error) => {
          console.error('Erreur création manifeste:', err);
          this.errorMessage = 'Erreur lors de la création du manifest: ' + err.message;
        }
      });
    }
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

    // Créer le destinataire d'abord
    const destinataire = {
      nom: formValue.pickupName,
      telephone: formValue.phone1,
      telephone2: formValue.phone2,
      adresse: formValue.address,
      ville: formValue.city,
      gouvernorat: formValue.governorate
    };

    // Générer un ID unique
    const uniqueId = 'CMD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const commande: Commande = {
      id: uniqueId,
      clientId,
      adresseDepartId: 'adresse-depart-default-id',
      adresseArriveeId: formValue.address,
      statut: 'EN_ATTENTE',
      dateCreation: new Date().toISOString(),
      montantTotal: parseFloat(formValue.price) || 0,
      nomDestinataire: formValue.pickupName,
      telephone: formValue.phone1,
      typeService: formValue.typeService,
      codeBarre: uniqueId
    };

    this.apiService.creerCommande(commande).subscribe({
      next: (createdCommande) => {
        this.loading = false;
        this.commandes.push(createdCommande); // Ajouter immédiatement à mes commandes
        alert('Colis ajouté avec succès !');
        this.packageForm.reset();
        this.loadClientCommandes(); // Recharger depuis le backend pour être sûr
        this.setTab('dashboard');
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Erreur lors de la création de la commande';
      }
    });
  }

  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      formGroup.get(key)?.markAsTouched();
    });
  }

  viewOrderDetails(cmd: Commande): void {
    alert(`Détails de la commande ${cmd.id} en cours de développement`);
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  toggleSidebarMenu(): void {
    this.showSidebarMenu = !this.showSidebarMenu;
  }

  toggleManifestHistory(): void {
    this.showManifestHistory = !this.showManifestHistory;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  // Reclamations
  objetOptions = [
    'Colis non livré',
    'Colis endommagé',
    'Retard de livraison',
    'Erreur de destinataire',
    'Problème de paiement',
    'Autre'
  ];

  ajouterReclamation(): void {
    if (this.reclamationForm.invalid) {
      this.markFormGroupTouched(this.reclamationForm);
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    const formValue = this.reclamationForm.value;
    
    // Map frontend objet to backend type
    const typeMapping: { [key: string]: string } = {
      'Colis non livré': 'COLIS_NON_LIVRE',
      'Colis endommagé': 'COLIS_ENDOMMAGE',
      'Retard de livraison': 'RETARD',
      'Erreur de destinataire': 'ERREUR_DESTINATAIRE',
      'Problème de paiement': 'PAIEMENT',
      'Autre': 'AUTRE'
    };

    const backendReclamation = {
      clientId: this.clientId,
      commandeId: formValue.codeBarre,
      type: typeMapping[formValue.objet] || 'AUTRE',
      description: formValue.description,
      statut: 'EN_ATTENTE',
      objet: formValue.objet,
      codeBarre: formValue.codeBarre
    };

    this.apiService.creerReclamation(backendReclamation).subscribe({
      next: (createdReclamation) => {
        this.reclamationsList.push(createdReclamation);
        this.reclamationForm.reset();
        this.reclamationSuccessMsg = 'Réclamation envoyée avec succès !';
        setTimeout(() => this.reclamationSuccessMsg = '', 5000);
      },
      error: (err: Error) => {
        this.errorMessage = 'Erreur lors de l\'envoi de la réclamation: ' + err.message;
      }
    });
  }

  get filteredPendingCommandes(): Commande[] {
    if (!this.searchTerm) return this.pendingCommandes;
    return this.pendingCommandes.filter(c => 
      (c.id && c.id.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
      (c.adresseArriveeId && c.adresseArriveeId.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  // Stats methods
  getNonSerieuxCount(): number {
    return this.commandes.filter(c => c.statut === 'NON_SERIEUX').length;
  }

  getEnAttenteCount(): number {
    return this.commandes.filter(c => c.statut === 'EN_ATTENTE').length;
  }

  getAEnleverCount(): number {
    return this.commandes.filter(c => c.statut === 'A_ENLEVER').length;
  }

  getEnlevesCount(): number {
    return this.commandes.filter(c => c.statut === 'ENLEVE').length;
  }

  getAuDepotCount(): number {
    return this.commandes.filter(c => c.statut === 'AU_DEPOT').length;
  }

  getEnCoursCount(): number {
    return this.commandes.filter(c => c.statut === 'EN_COURS').length;
  }

  getALaLivrerCount(): number {
    return this.commandes.filter(c => c.statut === 'A_LIVRER').length;
  }

  getLivreCount(): number {
    return this.commandes.filter(c => c.statut === 'LIVRE').length;
  }

  getLivrePayeCount(): number {
    return this.commandes.filter(c => c.statut === 'LIVRE_PAYE').length;
  }

  getEnAttenteRetourCount(): number {
    return this.commandes.filter(c => c.statut === 'EN_ATTENTE_RETOUR').length;
  }

  getRetourRecuCount(): number {
    return this.commandes.filter(c => c.statut === 'RETOUR_RECU').length;
  }

  getSelectedStatusPackages(): Commande[] {
    return this.commandes.filter(c => c.statut === this.selectedStatus);
  }

  selectedStatusPackages: Commande[] = [];
  selectedStatus = '';

  // Real-time notifications
  notificationsList = [
    { id: 1, text: 'Votre commande #CMD-84920 a été validée par l\'admin', date: 'Il y a 10 min', read: false },
    { id: 2, text: 'Le livreur Ahmed est en route vers l\'adresse de livraison', date: 'Il y a 30 min', read: false },
    { id: 3, text: 'Remboursement de 150 DT traité pour la livraison #CMD-7712', date: 'Hier', read: true }
  ];

  // Stats Grid matching exact screenshot requirements
  nonSerieuxCount = 0;
  enAttenteCount = 0;
  aEnleverCount = 0;
  enlevesCount = 0;
  auDepotCount = 4;
  enCoursCount = 2;
  aLaLivrerCount = 3;
  livreCount = 15;
  livrePayeCount = 12;
  enAttenteRetourCount = 2;
  retourRecuCount = 1;

  // Stats calculations
  totalColis = 39;
  totalLivre = 27;
  totalRetour = 3;
  tauxLivraison = 69.2;
  tauxRetour = 7.7;

  getLivrePayesTotal(): number {
    this.livrePayesTotal = this.commandes
      .filter(c => c.statut === 'LIVREE')
      .reduce((sum, c) => sum + (c.montantTotal || 0), 0);
    return this.livrePayesTotal;
  }

  livrePayesTotal = 0;

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

  onDashboardSearch(): void {
    if (!this.searchTerm) {
      alert('Veuillez entrer un code ou un numéro');
      return;
    }

    // Search in commandes
    const found = this.commandes.find(c => 
      c.id?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      c.adresseArriveeId?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );

    if (found) {
      this.searchResult = found;
    } else {
      alert('Colis non trouvé');
      this.searchResult = null;
    }
  }

  getLivreurInitials(livreurId: string): string {
    if (!livreurId) return '?';
    const parts = livreurId.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return livreurId.substring(0, 2).toUpperCase();
  }

  getTimelineStatus(expectedStatus: string, currentStatus: string): string {
    const statusOrder = ['EN_ATTENTE', 'EN_LIVRAISON', 'LIVRE'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const expectedIndex = statusOrder.indexOf(expectedStatus);
    
    if (currentIndex === -1) return 'pending';
    if (expectedIndex < currentIndex) return 'completed';
    if (expectedIndex === currentIndex) return 'active';
    return 'pending';
  }

  contacterLivreur(livreurId: string): void {
    alert(`Appel du livreur: ${livreurId}`);
  }

  // Manifest printing
  validerEtImprimerManifest(): void {
    if (this.pendingCommandes.length === 0) {
      alert('Aucune commande dans le manifest');
      return;
    }

    // Créer le contenu HTML pour l'impression
    const printContent = this.generateManifestPrintContent();
    
    // Créer un nouveau manifeste validé
    const validatedManifest: Manifeste = {
      id: 'MAN-' + Date.now(),
      clientId: this.clientId,
      nombreColis: this.pendingCommandes.length,
      statut: 'VALIDE',
      colisIds: this.pendingCommandes.map(c => c.id).filter(id => id !== undefined) as string[],
      dateCreation: new Date().toISOString()
    };

    // Ajouter à la liste des manifestes validés
    this.validatedManifests.push(validatedManifest);
    
    // Ouvrir une nouvelle fenêtre d'impression
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Manifest BFExpress</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: #0ea5e9;
              margin-bottom: 10px;
            }
            .manifest-info {
              text-align: center;
              margin-bottom: 20px;
              font-size: 14px;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 10px;
              text-align: left;
            }
            th {
              background-color: #0ea5e9;
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .total-row {
              font-weight: bold;
              background-color: #e0f2fe !important;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }

    // Vider le manifest en cours
    this.pendingCommandes = [];
    this.currentManifeste = null;
    alert('Manifest validé et enregistré avec succès !');
  }

  reprintManifest(manifest: Manifeste): void {
    // Récupérer les commandes du manifeste depuis la liste complète
    const manifestCommandes = this.commandes.filter(c => 
      manifest.colisIds?.includes(c.id || '')
    );

    if (manifestCommandes.length === 0) {
      alert('Aucune commande trouvée pour ce manifeste');
      return;
    }

    // Temporairement remplacer pendingCommandes pour l'impression
    const originalPending = this.pendingCommandes;
    this.pendingCommandes = manifestCommandes;

    const printContent = this.generateManifestPrintContent();
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Manifest BFExpress - Réimpression</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: #0ea5e9;
              margin-bottom: 10px;
            }
            .manifest-info {
              text-align: center;
              margin-bottom: 20px;
              font-size: 14px;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 10px;
              text-align: left;
            }
            th {
              background-color: #0ea5e9;
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .total-row {
              font-weight: bold;
              background-color: #e0f2fe !important;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }

    // Restaurer pendingCommandes
    this.pendingCommandes = originalPending;
  }

  generateManifestPrintContent(): string {
    const today = new Date().toLocaleDateString('fr-FR');
    const total = this.calculateManifestTotal();
    
    let html = `
      <h1>📋 Manifest BFExpress</h1>
      <div class="manifest-info">
        <p>Date: ${today}</p>
        <p>Nombre de colis: ${this.pendingCommandes.length}</p>
        <p>Total: ${total} DT</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Code à barre</th>
            <th>Nom</th>
            <th>Adresse</th>
            <th>Téléphone</th>
            <th>Prix</th>
          </tr>
        </thead>
        <tbody>
    `;

    this.pendingCommandes.forEach(cmd => {
      const date = cmd.dateCreation ? new Date(cmd.dateCreation).toLocaleDateString('fr-FR') : '-';
      const codeBarre = cmd.codeBarre || cmd.id || '-';
      const nom = cmd.nomDestinataire || cmd.adresseArriveeId?.split(',')[0] || '-';
      const adresse = cmd.adresseArriveeId || '-';
      const telephone = cmd.telephone || 'N/A';
      const prix = cmd.prix || cmd.montantTotal || 0;

      html += `
        <tr>
          <td>${date}</td>
          <td>${codeBarre}</td>
          <td>${nom}</td>
          <td>${adresse}</td>
          <td>${telephone}</td>
          <td>${prix} DT</td>
        </tr>
      `;
    });

    html += `
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5" style="text-align: right;"><strong>Total:</strong></td>
            <td><strong>${total} DT</strong></td>
          </tr>
        </tfoot>
      </table>
    `;

    return html;
  }

  calculateManifestTotal(): number {
    return this.pendingCommandes.reduce((sum, cmd) => {
      return sum + (cmd.prix || cmd.montantTotal || 0);
    }, 0);
  }

  clearManifest(): void {
    if (confirm('Voulez-vous vraiment vider le manifest ?')) {
      this.pendingCommandes = [];
      this.currentManifeste = null;
      alert('Manifest vidé avec succès');
    }
  }

  removeFromManifest(cmd: Commande): void {
    const index = this.pendingCommandes.findIndex(c => c.id === cmd.id);
    if (index > -1) {
      this.pendingCommandes.splice(index, 1);
      // Mise à jour du manifeste si nécessaire
      if (this.currentManifeste && this.currentManifeste.colisIds) {
        this.currentManifeste.colisIds = this.currentManifeste.colisIds.filter(id => id !== cmd.id);
        this.currentManifeste.nombreColis = this.currentManifeste.colisIds.length;
      }
    }
  }

  imprimerEtiquette(cmd: Commande): void {
    alert(`Impression de l'étiquette pour le colis ${cmd.id}`);
  }

  // Échange de colis methods
  validerEchange(): void {
    if (this.echangeForm.invalid) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const formValue = this.echangeForm.value;
    const ancienColisId = formValue.ancienColisId;

    // Trouver le colis à remplacer
    const colisIndex = this.commandes.findIndex(c => c.id === ancienColisId);
    
    if (colisIndex === -1) {
      alert('Colis non trouvé. Vérifiez l\'ID du colis.');
      return;
    }

    // Mettre à jour le colis avec les nouvelles coordonnées et prix
    const colis = this.commandes[colisIndex];
    colis.adresseArriveeId = formValue.nouveauAdresse;
    colis.prix = formValue.nouveauPrix;
    colis.statut = 'ECHANGE';
    
    // Simuler la mise à jour via API
    alert(`Colis ${ancienColisId} échangé avec succès !\nNouvelle destination: ${formValue.nouveauNom}, ${formValue.nouveauVille}\nNouveau prix: ${formValue.nouveauPrix} DT`);
    
    this.echangeForm.reset();
    this.loadClientCommandes();
  }

  resetEchangeForm(): void {
    this.echangeForm.reset();
  }

  // Form getters for validation
  get f() { return this.packageForm.controls; }
  get r() { return this.reclamationForm.controls; }

  // Helper methods for template
  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  contactMember(member: any): void {
    alert(`Ouverture du chat avec ${member.nom}...`);
  }

  callMember(member: any): void {
    window.location.href = `tel:${member.tel}`;
  }
}
