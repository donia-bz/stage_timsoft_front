import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-devenir-livreur',
  templateUrl: './devenir-livreur.component.html',
  styleUrls: ['./devenir-livreur.component.scss']
})
export class DevenirLivreurComponent {
  nom = '';
  prenom = '';
  email = '';
  motDePasse = '';
  telephone = '';
  vehicule = '';
  gouvernorat = '';

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
    if (!this.nom || !this.prenom || !this.email || !this.motDePasse || !this.telephone || !this.gouvernorat) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
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
      gouvernorat: this.gouvernorat,
      role: 'LIVREUR',
      statut: 'INSCRIPTION',
      latitudeActuelle: 0.0,
      longitudeActuelle: 0.0,
      noteMoyenne: 5.0
    };

    this.authService.register(payload).subscribe({
      next: (res) => {
        const livreurPayload = {
          id: res.id || 'LIV-' + Date.now(),
          nom: this.nom,
          prenom: this.prenom,
          email: this.email,
          telephone: this.telephone,
          gouvernorat: this.gouvernorat,
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
    this.nom = '';
    this.prenom = '';
    this.email = '';
    this.motDePasse = '';
    this.telephone = '';
    this.vehicule = '';
    this.gouvernorat = '';
  }
}
