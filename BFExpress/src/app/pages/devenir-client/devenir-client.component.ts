import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-devenir-client',
  templateUrl: './devenir-client.component.html',
  styleUrls: ['./devenir-client.component.scss']
})
export class DevenirClientComponent {
  nom = '';
  prenom = '';
  email = '';
  motDePasse = '';
  telephone = '';
  entreprise = '';
  
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
      role: 'CLIENT',
      entreprise: this.entreprise,
      adresseDefautId: 'DefaultAddr'
    };

    this.authService.register(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = 'Votre demande d\'inscription a été soumise avec succès! Vous recevrez une notification par email ou SMS dès que l\'administrateur aura approuvé votre compte.';
        // Reset form
        this.nom = '';
        this.prenom = '';
        this.email = '';
        this.motDePasse = '';
        this.telephone = '';
        this.entreprise = '';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Une erreur est survenue lors de l\'inscription.';
      }
    });
  }
}
