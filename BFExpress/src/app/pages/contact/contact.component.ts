import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent {
  prenom = '';
  nom = '';
  email = '';
  telephone = '';
  message = '';
  loading = false;
  successMessage = '';
  errorMessage = '';

  onSubmit(): void {
    if (!this.prenom || !this.nom || !this.email || !this.message) {
      this.errorMessage = 'Veuillez remplir les champs obligatoires.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const contact = {
      id: 'MSG-' + Date.now(),
      prenom: this.prenom,
      nom: this.nom,
      email: this.email,
      telephone: this.telephone,
      message: this.message,
      date: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(localStorage.getItem('bf_contacts') || '[]');
      existing.push(contact);
      localStorage.setItem('bf_contacts', JSON.stringify(existing));
      this.successMessage = 'Votre message a été envoyé avec succès. Notre équipe vous répondra sous 24h.';
      this.prenom = '';
      this.nom = '';
      this.email = '';
      this.telephone = '';
      this.message = '';
    } catch {
      this.errorMessage = 'Une erreur est survenue lors de l\'envoi.';
    } finally {
      this.loading = false;
    }
  }
}
