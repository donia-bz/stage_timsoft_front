import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  motDePasse = '';
  errorMessage = '';
  loading = false;
  loadingLocation = false;
  locationMessage = '';
  showManual = false;
  manualLat: number | null = null;
  manualLon: number | null = null;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.email || !this.motDePasse) {
      this.errorMessage = 'Veuillez saisir votre email et votre mot de passe.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    // Mode développement : redirection directe selon l'email
    if (this.email.includes('admin')) {
      this.loading = false;
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'admin-dev',
        nom: 'Admin',
        prenom: 'Dev',
        email: this.email,
        role: 'ADMIN',
        token: 'dev-token'
      }));
      this.router.navigate(['/dashboard-admin']);
      return;
    }

    if (this.email.includes('livreur')) {
      this.loading = false;
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'livreur-dev',
        nom: 'Livreur',
        prenom: 'Dev',
        email: this.email,
        role: 'LIVREUR',
        token: 'dev-token'
      }));
      this.router.navigate(['/dashboard-livreur']);
      return;
    }

    // Mode développement : accepter n'importe quel autre email comme client
    this.loading = false;
    localStorage.setItem('currentUser', JSON.stringify({
      id: 'client-dev-' + Date.now(),
      nom: 'Client',
      prenom: 'Dev',
      email: this.email,
      role: 'CLIENT',
      token: 'dev-token'
    }));
    this.router.navigate(['/dashboard']);
  }

  useCurrentLocation(): void {
    if (!('geolocation' in navigator)) {
      this.locationMessage = "Géolocalisation non supportée par votre navigateur.";
      return;
    }

    this.loadingLocation = true;
    this.locationMessage = '';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          localStorage.setItem('clientLocation', JSON.stringify({ latitude: lat, longitude: lon }));
          this.locationMessage = 'Localisation enregistrée.';
        } catch (e) {
          this.locationMessage = 'Impossible d\'enregistrer la localisation en local.';
        }
        this.loadingLocation = false;
      },
      (err) => {
        this.locationMessage = err.message || 'Impossible de récupérer la localisation.';
        this.loadingLocation = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  toggleManual(): void {
    this.showManual = !this.showManual;
  }

  saveManualLocation(): void {
    if (this.manualLat === null || this.manualLon === null || isNaN(this.manualLat) || isNaN(this.manualLon)) {
      this.locationMessage = 'Veuillez saisir des coordonnées valides.';
      return;
    }

    try {
      localStorage.setItem('clientLocation', JSON.stringify({ latitude: this.manualLat, longitude: this.manualLon }));
      this.locationMessage = 'Localisation enregistrée.';
      this.showManual = false;
    } catch (e) {
      this.locationMessage = 'Impossible d\'enregistrer la localisation en local.';
    }
  }

  autoFillLocation(): void {
    if (!('geolocation' in navigator)) {
      this.locationMessage = "Géolocalisation non supportée par votre navigateur.";
      return;
    }

    this.loadingLocation = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.manualLat = pos.coords.latitude;
        this.manualLon = pos.coords.longitude;
        this.locationMessage = '';
        this.loadingLocation = false;
      },
      (err) => {
        this.locationMessage = err.message || 'Impossible de récupérer la localisation.';
        this.loadingLocation = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
}
