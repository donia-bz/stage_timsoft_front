import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

interface Manifeste {
  id?: string;
  clientId: string;
  nombreColis: number;
  statut: string;
  colisIds?: string[];
  dateCreation?: string;
}

export interface Reclamation {
  id?: string;
  objet: string;
  codeBarre: string;
  description: string;
  dateCreation: string;
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
  currentManifeste: Manifeste | null = null;
  addresses: any[] = [];
  unreadNotifications = 0;
  currentDate: Date = new Date();

  activeTab = 'dashboard';
  isConnected = true;
  showAddAddress = false;
  showSidebarMenu = false;

  // Live Map GPS Client
  private clientMap: any = null;
  selectedTrackingCmd: Commande | null = null;
  driverPosition = { lat: 36.8065, lon: 10.1815, name: 'Livreur BFExpress' };

  // IA Estimation
  estimatedPrice: number = 7.0;
  estimatedTime: string = '24h - 48h';
  aiConfidence: number = 95;

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

  // Method to get count by status
  getStatusCount(status: string): number {
    return this.commandes.filter(cmd => cmd.statut === status).length;
  }

  // Method to calculate return rate
  calculateReturnRate(): number {
    const totalDeliveries = this.getStatusCount('LIVRE') + this.getStatusCount('LIVRE_PAYE');
    const totalReturns = this.getStatusCount('ECHANGE') + 
                      this.getStatusCount('RETOUR_DEFINITIF') + 
                      this.getStatusCount('RETOUR_INTERAGENCE') + 
                      this.getStatusCount('RETOUR_RECU');
    
    if (totalDeliveries === 0) return 0;
    return Math.round((totalReturns / totalDeliveries) * 100);
  }

  // Search filter inside table
  searchTerm = '';

  // Reactive Form for adding package
  packageForm: FormGroup;
  profileForm: FormGroup;

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
  }

  ongoingOrder?: Commande;

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clientName = `${user.prenom} ${user.nom}`;
      this.clientId = user.id;
      this.loadClientCommandes();
      this.loadUserProfile();
      this.loadCurrentManifeste();
    }
  }

  get filteredCommandes(): Commande[] {
    if (!this.searchTerm) return this.commandes;
    return this.commandes.filter(cmd => 
      cmd.id?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      cmd.adresseArriveeId?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  loadUserProfile(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.profileForm.patchValue({
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: '',
        entreprise: ''
      });
    }
  }

  updateProfile(): void {
    alert('Mise à jour du profil en cours de développement');
  }

  addAddress(): void {
    alert('Ajout d\'adresse en cours de développement');
  }

  deleteAddress(id: string): void {
    this.addresses = this.addresses.filter(a => a.id !== id);
  }

  setDefaultAddress(id: string): void {
    this.addresses.forEach(a => a.isDefault = a.id === id);
  }

  loadCurrentManifeste(): void {
    if (!this.clientId) return;

    this.apiService.getBrouillonManifeste(this.clientId).subscribe({
      next: (manifeste: Manifeste) => {
        this.currentManifeste = manifeste;
        // Load the colis from the manifest
        if (manifeste.colisIds && manifeste.colisIds.length > 0) {
          this.pendingCommandes = [];
          manifeste.colisIds.forEach(colisId => {
            this.apiService.getCommandeById(colisId).subscribe({
              next: (cmd: Commande) => {
                this.pendingCommandes.push(cmd);
              }
            });
          });
        }
      },
      error: (err: Error) => console.error('Error loading manifeste:', err)
    });
  }

  addCommandToManifest(): void {
    console.log('Bouton Ajouter cliqué');
    
    const formValue = this.packageForm.value;
    console.log('Valeurs formulaire:', formValue);
    
    // Générer un ID unique pour la commande
    const uniqueId = 'CMD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    const commande: Commande = {
      id: uniqueId,
      clientId: this.clientId || 'test-client-id',
      adresseDepartId: 'adresse-depart-default',
      adresseArriveeId: formValue.address || 'Adresse test',
      statut: 'EN_ATTENTE',
      typeService: formValue.typeService || 'STANDARD',
      montantTotal: parseFloat(formValue.price) || 25.0,
      dateCreation: new Date().toISOString()
    };

    console.log('Envoi de la commande au backend MongoDB:', commande);
    
    // Créer la commande via le backend MongoDB
    this.apiService.creerCommande(commande).subscribe({
      next: (createdCmd: Commande) => {
        console.log('Commande créée dans MongoDB:', createdCmd);
        
        // Ajouter au manifeste brouillon existant ou en créer un nouveau
        if (this.currentManifeste && this.currentManifeste.id) {
          console.log('Mise à jour du manifeste existant:', this.currentManifeste.id);
          this.apiService.updateManifeste(this.currentManifeste.id, {
            ...this.currentManifeste,
            colisIds: [...(this.currentManifeste.colisIds || []), createdCmd.id!],
            nombreColis: (this.currentManifeste.nombreColis || 0) + 1
          }).subscribe({
            next: (updatedManifeste: Manifeste) => {
              console.log('Manifeste mis à jour dans MongoDB:', updatedManifeste);
              this.currentManifeste = updatedManifeste;
              this.pendingCommandes.push(createdCmd);
              this.packageForm.reset();
              alert(`Commande ajoutée au manifest !\nID: ${createdCmd.id}\nStatut: EN_ATTENTE\n✅ Stockée dans MongoDB`);
            },
            error: (err: Error) => {
              console.error('Erreur mise à jour manifeste:', err);
              this.errorMessage = 'Erreur lors de l\'ajout au manifest: ' + err.message;
              alert('Erreur: ' + err.message);
            }
          });
        } else {
          console.log('Création nouveau manifeste dans MongoDB');
          const newManifeste: Manifeste = {
            clientId: this.clientId || 'test-client-id',
            nombreColis: 1,
            statut: 'BROUILLON',
            colisIds: [createdCmd.id!]
          };
          this.apiService.creerManifeste(newManifeste).subscribe({
            next: (createdManifeste: Manifeste) => {
              console.log('Nouveau manifeste créé dans MongoDB:', createdManifeste);
              this.currentManifeste = createdManifeste;
              this.pendingCommandes.push(createdCmd);
              this.packageForm.reset();
              alert(`Commande ajoutée au manifest !\nID: ${createdCmd.id}\nStatut: EN_ATTENTE\n✅ Stockée dans MongoDB`);
            },
            error: (err: Error) => {
              console.error('Erreur création manifeste:', err);
              this.errorMessage = 'Erreur lors de la création du manifest: ' + err.message;
              alert('Erreur: ' + err.message);
            }
          });
        }
      },
      error: (err: Error) => {
        console.error('Erreur création commande dans MongoDB:', err);
        this.errorMessage = 'Erreur lors de la création de la commande: ' + err.message;
        alert('❌ Erreur backend: ' + err.message + '\n\n⚠️ Le backend n\'est probablement pas démarré.\n\nPour utiliser MongoDB, vous devez:\n1. Installer Maven\n2. Démarrer les microservices backend\n\nEn attendant, le mode local est disponible.');
      }
    });
  }

  removeFromManifest(cmd: Commande): void {
    this.pendingCommandes = this.pendingCommandes.filter(c => c !== cmd);
  }

  clearManifest(): void {
    if (confirm('Vider le manifest ?')) {
      this.pendingCommandes = [];
    }
  }

  validateManifest(): void {
    // Cette fonction est remplacée par validerEtImprimerManifest()
    this.validerEtImprimerManifest();
  }

  calculateManifestTotal(): number {
    return this.pendingCommandes.reduce((sum, cmd) => sum + (cmd.montantTotal || 0), 0);
  }

  viewOrderDetails(cmd: Commande): void {
    alert(`Détails de la commande ${cmd.id} en cours de développement`);
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'suivi') {
      this.initMapClient();
    }
  }

  toggleSidebarMenu(): void {
    this.showSidebarMenu = !this.showSidebarMenu;
  }

  updateAIEstimation(): void {
    const gov = this.packageForm.get('governorate')?.value;
    const typeService = this.packageForm.get('typeService')?.value;

    if (typeService === 'EXPRESS') {
      this.estimatedPrice = 12.0;
      this.estimatedTime = ' Moins de 24h Express';
      this.aiConfidence = 98;
    } else if (gov === 'Tunis' || gov === 'Ariana' || gov === 'Ben Arous' || gov === 'Manouba') {
      this.estimatedPrice = 7.0;
      this.estimatedTime = '24h (Grand Tunis)';
      this.aiConfidence = 96;
    } else {
      this.estimatedPrice = 8.5;
      this.estimatedTime = '24h - 48h (Régional)';
      this.aiConfidence = 92;
    }
  }

  initMapClient(): void {
    setTimeout(() => {
      const container = document.getElementById('client-map');
      if (!container || (window as any).L === undefined) return;
      if (this.clientMap) {
        this.clientMap.remove();
        this.clientMap = null;
      }
      const L = (window as any).L;
      this.clientMap = L.map('client-map').setView([this.driverPosition.lat, this.driverPosition.lon], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(this.clientMap);

      // Marqueur Livreur
      const driverIcon = L.divIcon({
        className: 'custom-driver-icon',
        html: '<div style="background:#0ea5e9;color:white;padding:6px;border-radius:50%;font-size:1.2rem;box-shadow:0 0 10px rgba(14,165,233,0.5);">🚚</div>'
      });

      L.marker([this.driverPosition.lat, this.driverPosition.lon], { icon: driverIcon })
        .addTo(this.clientMap)
        .bindPopup(`<b>${this.driverPosition.name}</b><br>En route pour livraison`)
        .openPopup();

      // Destination client
      L.marker([36.83, 10.22])
        .addTo(this.clientMap)
        .bindPopup('<b>Point de livraison Client</b><br>Adresse Destinataire');
    }, 250);
  }

  imprimerEtiquette(cmd: Commande): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${cmd.id || 'CMD-BFEXPRESS'}`;

    const labelHtml = `
      <html>
      <head>
        <title>Étiquette Colis #${cmd.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
          .label-box { width: 340px; margin: 0 auto; border: 3px dashed #0f172a; padding: 20px; border-radius: 16px; background: #fafafa; }
          .header { font-size: 1.5rem; font-weight: 900; color: #0ea5e9; margin-bottom: 5px; }
          .sub { font-size: 0.85rem; color: #64748b; margin-bottom: 15px; }
          .barcode { margin: 15px 0; }
          .details { text-align: left; background: white; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 15px; font-size: 0.9rem; }
          .row { margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <div class="label-box">
          <div class="header">⚡ BFExpress</div>
          <div class="sub">Bordereau officiel d'expédition</div>
          <img class="barcode" src="${qrUrl}" alt="QR Code Colis" />
          <div style="font-weight: 800; font-size: 1.1rem;">#${cmd.id || 'CMD-0000'}</div>
          <div class="details">
            <div class="row"><strong>Destinataire:</strong> ${cmd.adresseArriveeId || 'Client BFExpress'}</div>
            <div class="row"><strong>Service:</strong> ${cmd.typeService || 'STANDARD'}</div>
            <div class="row"><strong>Montant COD:</strong> ${cmd.montantTotal || 0} DT</div>
            <div class="row"><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(labelHtml);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
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
    
    // Créer le destinataire d'abord
    const destinataire = {
      nom: formValue.pickupName,
      telephone: formValue.phone1,
      adresseId: 'adresse-temp-id' // Serait créé avec l'adresse
    };

    // Créer l'adresse du destinataire
    const adresse = {
      rue: formValue.address,
      ville: formValue.city,
      codePostal: formValue.locality,
      latitude: 36.8065,
      longitude: 10.1815,
      adressePrincipale: true
    };

    const commande: Commande = {
      clientId,
      adresseDepartId: 'adresse-depart-default',
      adresseArriveeId: formValue.address,
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
    this.aEnleverCount = this.commandes.filter(c => c.statut === 'VALIDEE' || c.statut === 'A_ENLEVER').length;
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

  validerEtImprimerManifest(): void {
    if (this.pendingCommandes.length === 0) {
      alert('Aucun colis en attente à valider dans le manifeste.');
      return;
    }

    if (!this.currentManifeste || !this.currentManifeste.id) {
      alert('Aucun manifeste en cours');
      return;
    }

    // Valider le manifeste
    this.apiService.validerManifeste(this.currentManifeste.id).subscribe({
      next: (validatedManifeste: Manifeste) => {
        this.currentManifeste = validatedManifeste;
        
        // Imprimer le manifeste
        this.imprimerManifeste();
        
        // Mettre à jour les commandes
        this.pendingCommandes.forEach(cmd => {
          if (cmd.id) {
            this.apiService.updateCommandeStatut(cmd.id, 'A_ENLEVER').subscribe();
          }
        });
        
        // Vider la liste locale
        this.pendingCommandes = [];
        this.loadClientCommandes();
        
        alert('Manifeste validé et imprimé avec succès !');
      },
      error: (err: Error) => {
        this.errorMessage = 'Erreur lors de la validation du manifest: ' + err.message;
      }
    });
  }

  imprimerManifeste(): void {
    if (this.pendingCommandes.length === 0) {
      alert('Aucune commande à imprimer');
      return;
    }
    
    // Créer une fenêtre d'impression
    const printContent = `
      <html>
      <head>
        <title>Manifest BFExpress</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #0ea5e9; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f0f9ff; }
          .summary { margin: 20px 0; padding: 15px; background: #f0f9ff; border-radius: 10px; }
        </style>
      </head>
      <body>
        <h1>Manifest BFExpress</h1>
        <div class="summary">
          <p>Date: ${new Date().toLocaleDateString()}</p>
          <p>Nombre de colis: ${this.pendingCommandes.length}</p>
          <p>Total: ${this.calculateManifestTotal()} DT</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Destinataire</th>
              <th>Adresse</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            ${this.pendingCommandes.map(cmd => `
              <tr>
                <td>${cmd.adresseArriveeId}</td>
                <td>${cmd.adresseArriveeId}</td>
                <td>${cmd.montantTotal} DT</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  }

  getRetourCommandes(): Commande[] {
    const retourStatuses = [
      'RETOUR_DEPOT',
      'RETOUR_DEFINITIF',
      'RETOUR_INTER_AGENCE',
      'RETOUR_EXPEDITEURS',
      'RETOUR_RECU'
    ];
    return this.commandes.filter(c => retourStatuses.includes(c.statut));
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
      dateCreation: new Date().toISOString(),
      statut: 'En cours de traitement'
    };

    this.reclamationsList.unshift(newRec);
    this.reclamationSuccessMsg = 'Réclamation ajoutée avec succès ! Notre équipe la traite dans les plus brefs délais.';
    
    // Reset form
    this.reclamationForm.reset();

    setTimeout(() => this.reclamationSuccessMsg = '', 5000);
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

  formatDate(date: string): string {
    return new Date(date).toLocaleString('fr-FR');
  }
}
