import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-devenir-livreur',
  templateUrl: './devenir-livreur.component.html',
  styleUrls: ['./devenir-livreur.component.scss']
})
export class DevenirLivreurComponent {
  // Informations personnelles
  nom = '';
  prenom = '';
  email = '';
  motDePasse = '';
  telephone = '';
  adresse = '';
  ville = '';
  codePostal = '';
  gouvernorat = '';
  dateNaissance = '';

  // Informations véhicule
  typeVehicule = '';
  marqueModele = '';
  immatriculation = '';
  numeroPermis = '';
  compagnieAssurance = '';
  numeroPolice = '';

  // Disponibilité
  dateDebut = '';
  disponibilite = {
    lundi: false,
    mardi: false,
    mercredi: false,
    jeudi: false,
    vendredi: false,
    samedi: false,
    dimanche: false
  };
  heureDebut = '';
  heureFin = '';

  // Accord
  acceptConditions = false;

  gouvernorats = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
    'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir',
    'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès',
    'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
  ];

  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  onSubmit(): void {
    // Validation des champs obligatoires
    if (!this.nom || !this.prenom || !this.email || !this.motDePasse || 
        !this.telephone || !this.adresse || !this.ville || !this.gouvernorat || 
        !this.dateNaissance || !this.typeVehicule || !this.immatriculation || 
        !this.numeroPermis || !this.compagnieAssurance || !this.numeroPolice || 
        !this.dateDebut || !this.acceptConditions) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires (*).';
      return;
    }

    // Vérifier qu'au moins un jour de disponibilité est sélectionné
    const hasAvailability = Object.values(this.disponibilite).some(day => day === true);
    if (!hasAvailability) {
      this.errorMessage = 'Veuillez sélectionner au moins un jour de disponibilité.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      nom: this.nom,
      prenom: this.prenom,
      email: this.email,
      motDePasse: this.motDePasse,
      telephone: this.telephone,
      role: 'LIVREUR',
      gouvernorat: this.gouvernorat,
      adresse: this.adresse,
      ville: this.ville,
      dateNaissance: this.dateNaissance
    };

    this.authService.register(payload).subscribe({
      next: (res) => {
        const livreurPayload = {
          id: res.id || 'LIV-' + Date.now(),
          nom: this.nom,
          prenom: this.prenom,
          email: this.email,
          telephone: this.telephone,
          adresse: this.adresse,
          ville: this.ville,
          codePostal: this.codePostal,
          gouvernorat: this.gouvernorat,
          dateNaissance: this.dateNaissance,
          typeVehicule: this.typeVehicule,
          marqueModele: this.marqueModele,
          immatriculation: this.immatriculation,
          numeroPermis: this.numeroPermis,
          compagnieAssurance: this.compagnieAssurance,
          numeroPolice: this.numeroPolice,
          dateDebut: this.dateDebut,
          disponibilite: this.disponibilite,
          heureDebut: this.heureDebut,
          heureFin: this.heureFin,
          typePermis: 'B',
          statut: 'INSCRIPTION',
          dateInscription: new Date().toISOString(),
          noteMoyenne: 5.0,
          nombreLivraisons: 0
        };

        this.apiService.creerLivreur(livreurPayload).subscribe({
          next: () => this.finishSuccess(),
          error: () => this.finishSuccess()
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Une erreur est survenue lors de l\'inscription.';
      }
    });
  }

  private finishSuccess(): void {
    this.loading = false;
    this.successMessage = 'Votre candidature de livreur a été enregistrée avec succès! Un administrateur validera votre dossier et vous affectera à un gouvernorat.';
    this.resetForm();
  }

  private resetForm(): void {
    this.nom = '';
    this.prenom = '';
    this.email = '';
    this.motDePasse = '';
    this.telephone = '';
    this.adresse = '';
    this.ville = '';
    this.codePostal = '';
    this.gouvernorat = '';
    this.dateNaissance = '';
    this.typeVehicule = '';
    this.marqueModele = '';
    this.immatriculation = '';
    this.numeroPermis = '';
    this.compagnieAssurance = '';
    this.numeroPolice = '';
    this.dateDebut = '';
    this.disponibilite = {
      lundi: false,
      mardi: false,
      mercredi: false,
      jeudi: false,
      vendredi: false,
      samedi: false,
      dimanche: false
    };
    this.heureDebut = '';
    this.heureFin = '';
    this.acceptConditions = false;
  }
}
