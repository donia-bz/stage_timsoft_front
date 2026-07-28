import { Component } from '@angular/core';

@Component({
  selector: 'app-reclamations',
  templateUrl: './reclamations.component.html',
  styleUrls: ['./reclamations.component.scss']
})
export class ReclamationsComponent {
  customerName = '';
  issueDescription = '';

  submitClaim() {
    // placeholder for future claim submission logic
    alert(`Réclamation envoyée pour ${this.customerName}`);
  }
}
