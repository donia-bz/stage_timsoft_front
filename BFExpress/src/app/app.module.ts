import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AppComponent } from './app.component';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { HomeComponent } from './pages/home/home.component';
import { ServicesComponent } from './pages/services/services.component';
import { FaqComponent } from './pages/faq/faq.component';
import { ContactComponent } from './pages/contact/contact.component';
import { DevenirClientComponent } from './pages/devenir-client/devenir-client.component';
import { DevenirLivreurComponent } from './pages/devenir-livreur/devenir-livreur.component';
import { SuiviComponent } from './pages/suivi/suivi.component';
import { LoginComponent } from './pages/login/login.component';
import { RechercheColisComponent } from './pages/recherche-colis/recherche-colis.component';
import { ReclamationsComponent } from './pages/reclamations/reclamations.component';
import { AjoutColisComponent } from './pages/ajout-colis/ajout-colis.component';
import { PaiementsComponent } from './pages/paiements/paiements.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardAdminComponent } from './pages/dashboard-admin/dashboard-admin.component';
import { DashboardLivreurComponent } from './pages/dashboard-livreur/dashboard-livreur.component';
import { AuthGuard } from './auth.guard';
import { AuthAdminGuard } from './auth-admin.guard';
import { AuthLivreurGuard } from './auth-livreur.guard';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'services', component: ServicesComponent },
  { path: 'faq', component: FaqComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'suivi', component: SuiviComponent },
  { path: 'recherche-colis', component: RechercheColisComponent },
  { path: 'reclamations', component: ReclamationsComponent },
  { path: 'ajout-colis', component: AjoutColisComponent },
  { path: 'paiements', component: PaiementsComponent },
  { path: 'dashboard-livreur', loadComponent: () => import('./pages/dashboard-livreur/dashboard-livreur.component').then(m => m.DashboardLivreurComponent), canActivate: [AuthLivreurGuard] },
  { path: 'dashboard-admin', loadComponent: () => import('./pages/dashboard-admin/dashboard-admin.component').then(m => m.DashboardAdminComponent), canActivate: [AuthAdminGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'devenir-client', component: DevenirClientComponent },
  { path: 'devenir-livreur', component: DevenirLivreurComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    HomeComponent,
    ServicesComponent,
    FaqComponent,
    ContactComponent,
    SuiviComponent,
    LoginComponent,
    DevenirClientComponent,
    DevenirLivreurComponent,
    RechercheColisComponent,
    ReclamationsComponent,
    AjoutColisComponent,
    PaiementsComponent,
    DashboardComponent
  ],
  imports: [BrowserModule, CommonModule, FormsModule, ReactiveFormsModule, HttpClientModule, RouterModule.forRoot(routes)],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
