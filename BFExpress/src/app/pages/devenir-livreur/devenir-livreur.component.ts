import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

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

  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (!this.nom || !this.prenom || !this.email || !this.motDePasse || !this.telephone) {
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
      role: 'LIVREUR',
      statut: 'DISPONIBLE',
      latitudeActuelle: 0.0,
      longitudeActuelle: 0.0,
      noteMoyenne: 5.0
    };

    this.authService.register(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = 'Votre candidature de livreur a été enregistrée avec succès! Vous recevrez une notification par SMS ou Email dès que l\'administrateur aura approuvé votre dossier.';
        // Reset form
        this.nom = '';
        this.prenom = '';
        this.email = '';
        this.motDePasse = '';
        this.telephone = '';
        this.vehicule = '';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Une erreur est survenue lors de l\'inscription.';
      }
    });
  }
}
