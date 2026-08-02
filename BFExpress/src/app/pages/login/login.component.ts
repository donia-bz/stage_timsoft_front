import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.email || !this.motDePasse) {
      this.errorMessage = 'Veuillez saisir votre email et votre mot de passe.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.motDePasse).subscribe({
      next: (res) => {
        this.loading = false;
        // Redirect depending on role
        if (res.role === 'ADMIN') {
          this.router.navigate(['/dashboard-admin']);
        } else if (res.role === 'LIVREUR') {
          this.router.navigate(['/dashboard-livreur']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 0) {
          this.errorMessage = "Impossible de se connecter au serveur d'authentification (port 8082). Veuillez vous assurer que le microservice Spring Boot (auth-service) est bien démarré.";
        } else if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else if (err.error && err.error.message) {
          this.errorMessage = err.error.message;
        } else {
          this.errorMessage = 'Identifiants incorrects ou compte non approuvé.';
        }
      }
    });
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
