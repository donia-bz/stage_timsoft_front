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
}
