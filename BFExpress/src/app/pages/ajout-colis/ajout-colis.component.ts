import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, Commande } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-ajout-colis',
  templateUrl: './ajout-colis.component.html',
  styleUrls: ['./ajout-colis.component.scss']
})
export class AjoutColisComponent implements OnInit {
  clientName = '';
  governorate = 'Tunis';
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

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.clientName = `${user.prenom} ${user.nom}`;
    }
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

    // Pour simplifier, on utilise des IDs d'adresses par défaut
    // Dans une vraie application, l'utilisateur devrait sélectionner ses adresses enregistrées
    const commande: Commande = {
      clientId: clientId,
      adresseDepartId: 'adresse-depart-default-id',
      adresseArriveeId: 'adresse-arrivee-default-id',
      statut: 'EN_ATTENTE',
      typeService: this.typeService,
      montantTotal: parseFloat(this.price) || 25.0
    };

    this.apiService.creerCommande(commande).subscribe({
      next: (createdCmd) => {
        // Call AI service to estimate delivery delay
        if (createdCmd.id) {
          this.apiService.predictDelai(
            createdCmd.id,
            36.8065, 10.1815,
            36.8500, 10.2000,
            this.typeService
          ).subscribe({
            next: (pred) => {
              alert(`Colis enregistré avec succès ! Estimation IA du délai : ${pred.delaiPreditMin} minutes.`);
              this.router.navigate(['/dashboard']);
            },
            error: () => {
              alert('Colis enregistré avec succès !');
              this.router.navigate(['/dashboard']);
            }
          });
        } else {
          alert('Colis enregistré avec succès !');
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || err.message || 'Erreur lors de la création de la commande.';
      }
    });
  }
}
