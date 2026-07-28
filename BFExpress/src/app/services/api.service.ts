import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Adresse {
  rue: string;
  ville: string;
  codePostal: string;
  pays: string;
  latitude?: number;
  longitude?: number;
}

export interface Commande {
  id?: string;
  clientId: string;
  adresseDepart: Adresse;
  adresseArrivee: Adresse;
  statut: string; // EN_ATTENTE, VALIDEE, EN_LIVRAISON, LIVREE, ANNULEE
  typeService: string; // STANDARD, EXPRESS
  dateCreation?: string;
  delaiEstimeMin?: number;
  montantTotal: number;
  colisIds?: string[];
}

export interface Livreur {
  id: string;
  nom: string;
  prenom: string;
  statut: string; // disponible, en_course, hors_ligne
  latitudeActuelle: number;
  longitudeActuelle: number;
  vehiculeId?: string;
  noteMoyenne?: number;
}

export interface Livraison {
  id: string;
  commandeId: string;
  livreurId: string;
  statut: string; // affectee, en_cours, livree
  dateAffectation?: string;
  dateDebut?: string;
  dateFin?: string;
  distanceKm?: number;
}

export interface PredictionDelai {
  id?: string;
  commandeId: string;
  delaiPreditMin: number;
  dateCalcul: string;
  versionModele: string;
}

export interface AffectationIA {
  id?: string;
  colisId: string;
  livreurId: string;
  score: number;
  dateCalcul: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private commandesUrl = 'http://localhost:8081/api/commandes';
  private livreursUrl = 'http://localhost:8084/api';
  private trackingUrl = 'http://localhost:8083/api';
  private iaUrl = 'http://localhost:8085/api/ia';

  constructor(private http: HttpClient) {}

  // --- Commandes ---
  creerCommande(commande: Commande): Observable<Commande> {
    return this.http.post<Commande>(this.commandesUrl, commande);
  }

  getCommandeById(id: string): Observable<Commande> {
    return this.http.get<Commande>(`${this.commandesUrl}/${id}`);
  }

  getAllCommandes(): Observable<Commande[]> {
    return this.http.get<Commande[]>(this.commandesUrl);
  }

  getCommandesByClient(clientId: string): Observable<Commande[]> {
    return this.http.get<Commande[]>(`${this.commandesUrl}/client/${clientId}`);
  }

  updateCommandeStatut(id: string, statut: string): Observable<Commande> {
    return this.http.patch<Commande>(`${this.commandesUrl}/${id}/statut`, null, {
      params: new HttpParams().set('statut', statut)
    });
  }

  deleteCommande(id: string): Observable<void> {
    return this.http.delete<void>(`${this.commandesUrl}/${id}`);
  }

  // --- Livreurs ---
  getLivreurById(id: string): Observable<Livreur> {
    return this.http.get<Livreur>(`${this.livreursUrl}/livreurs/${id}`);
  }

  getAllLivreurs(): Observable<Livreur[]> {
    return this.http.get<Livreur[]>(`${this.livreursUrl}/livreurs`);
  }

  getLivreursDisponibles(): Observable<Livreur[]> {
    return this.http.get<Livreur[]>(`${this.livreursUrl}/livreurs/disponibles`);
  }

  updateLivreurStatut(id: string, statut: string): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/statut`, null, {
      params: new HttpParams().set('statut', statut)
    });
  }

  updateLivreurPosition(id: string, lat: number, lon: number): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/position`, null, {
      params: new HttpParams().set('latitude', lat.toString()).set('longitude', lon.toString())
    });
  }

  // --- Livraisons & Tracking ---
  creerLivraison(commandeId: string, livreurId: string): Observable<Livraison> {
    return this.http.post<Livraison>(`${this.trackingUrl}/livraisons`, null, {
      params: new HttpParams().set('commandeId', commandeId).set('livreurId', livreurId)
    });
  }

  demarrerLivraison(id: string): Observable<Livraison> {
    return this.http.patch<Livraison>(`${this.trackingUrl}/livraisons/${id}/demarrer`, null);
  }

  terminerLivraison(id: string): Observable<Livraison> {
    return this.http.patch<Livraison>(`${this.trackingUrl}/livraisons/${id}/terminer`, null);
  }

  getLivraisonById(id: string): Observable<Livraison> {
    return this.http.get<Livraison>(`${this.trackingUrl}/livraisons/${id}`);
  }

  getAllLivraisons(): Observable<Livraison[]> {
    return this.http.get<Livraison[]>(`${this.trackingUrl}/livraisons`);
  }

  getLivraisonsByLivreur(livreurId: string): Observable<Livraison[]> {
    return this.http.get<Livraison[]>(`${this.trackingUrl}/livraisons/livreur/${livreurId}`);
  }

  getLivraisonsByCommande(commandeId: string): Observable<Livraison[]> {
    return this.http.get<Livraison[]>(`${this.trackingUrl}/livraisons/commande/${commandeId}`);
  }

  // --- IA ---
  predictDelai(
    commandeId: string,
    latDepart?: number,
    longDepart?: number,
    latArrivee?: number,
    longArrivee?: number,
    typeService: string = 'STANDARD'
  ): Observable<PredictionDelai> {
    let params = new HttpParams().set('commandeId', commandeId).set('typeService', typeService);
    if (latDepart !== undefined) params = params.set('latDepart', latDepart.toString());
    if (longDepart !== undefined) params = params.set('longDepart', longDepart.toString());
    if (latArrivee !== undefined) params = params.set('latArrivee', latArrivee.toString());
    if (longArrivee !== undefined) params = params.set('longArrivee', longArrivee.toString());

    return this.http.post<PredictionDelai>(`${this.iaUrl}/predict-delai`, null, { params });
  }

  affecterLivreur(
    colisId: string,
    latColis?: number,
    longColis?: number,
    livreurs: Livreur[] = []
  ): Observable<AffectationIA> {
    let params = new HttpParams().set('colisId', colisId);
    if (latColis !== undefined) params = params.set('latColis', latColis.toString());
    if (longColis !== undefined) params = params.set('longColis', longColis.toString());

    // Utiliser un format DTO compatible avec le backend
    const livreurDTOs = livreurs.map(l => ({
      id: l.id,
      nom: l.nom,
      prenom: l.prenom,
      latitudeActuelle: l.latitudeActuelle,
      longitudeActuelle: l.longitudeActuelle,
      noteMoyenne: l.noteMoyenne || 5.0
    }));

    return this.http.post<AffectationIA>(`${this.iaUrl}/affecter-livreur`, livreurDTOs, { params });
  }
}
