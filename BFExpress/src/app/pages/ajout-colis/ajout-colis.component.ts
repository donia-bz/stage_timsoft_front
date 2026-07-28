import { Component } from '@angular/core';

@Component({
  selector: 'app-ajout-colis',
  templateUrl: './ajout-colis.component.html',
  styleUrls: ['./ajout-colis.component.scss']
})
export class AjoutColisComponent {
  clientName = '';
  governorate = '';
  city = '';
  locality = '';
  address = '';
  phone1 = '';
  phone2 = '';
  designation = '';
  price = '';
  itemCount = 1;
  packageCount = 1;
  paymentMode = 'Espèce seulement';
  openBeforePayment = 'Non';
  exchange = 'Non';
  remarks = '';

  submitPickup() {
    alert('Pickup ajouté avec succès.');
  }
}
