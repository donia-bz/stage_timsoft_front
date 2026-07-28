import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
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
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardLivreurComponent } from './pages/dashboard-livreur/dashboard-livreur.component';
import { DashboardAdminComponent } from './pages/dashboard-admin/dashboard-admin.component';
import { RechercheColisComponent } from './pages/recherche-colis/recherche-colis.component';
import { ReclamationsComponent } from './pages/reclamations/reclamations.component';
import { AjoutColisComponent } from './pages/ajout-colis/ajout-colis.component';
import { PaiementsComponent } from './pages/paiements/paiements.component';
import { FormsModule } from '@angular/forms';

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
  { path: 'dashboard-livreur', component: DashboardLivreurComponent },
  { path: 'dashboard-admin', component: DashboardAdminComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
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
    DashboardComponent,
    DashboardLivreurComponent,
    DashboardAdminComponent,
    DevenirClientComponent,
    DevenirLivreurComponent,
    RechercheColisComponent,
    ReclamationsComponent,
    AjoutColisComponent,
    PaiementsComponent
  ],
  imports: [BrowserModule, FormsModule, HttpClientModule, RouterModule.forRoot(routes)],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
