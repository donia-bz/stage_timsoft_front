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

    this.authService.login(this.email, this.motDePasse).subscribe({
      next: (res) => {
        this.loading = false;
        // La méthode login de AuthService stocke déjà l'utilisateur dans le localStorage
        
        // Redirection selon le rôle
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
        console.error('Erreur de connexion:', err);
        // Si le backend n'est pas encore prêt, on peut fallback sur un message d'erreur clair
        this.errorMessage = err.error?.message || 'Identifiants incorrects ou serveur injoignable.';
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
