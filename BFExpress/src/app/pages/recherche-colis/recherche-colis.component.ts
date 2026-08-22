import { Component } from '@angular/core';

@Component({
  selector: 'app-recherche-colis',
  templateUrl: './recherche-colis.component.html',
  styleUrls: ['./recherche-colis.component.scss']
})
export class RechercheColisComponent {
  packageCode = '';

  onSearch() {
    // placeholder for future search logic
    alert(`Recherche du colis : ${this.packageCode}`);
  }
}
