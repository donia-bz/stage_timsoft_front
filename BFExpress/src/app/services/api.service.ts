import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Adresse {
  id?: string;
  rue: string;
  ville: string;
  codePostal: string;
  latitude?: number;
  longitude?: number;
  adressePrincipale?: boolean;
}

export interface Commande {
  id?: string;
  clientId?: string;
  adresseDepartId: string;
  adresseArriveeId: string;
  adresseDepart?: Adresse;
  adresseArrivee?: Adresse;
  statut: string; // EN_ATTENTE, CONFIRMEE, EN_LIVRAISON, LIVREE, ANNULEE
  typeService: string; // STANDARD, EXPRESS
  dateCreation?: string;
  delaiEstimeMin?: number;
  montantTotal: number;
  predictionDelaiId?: string;
  affectationIAId?: string;
  colis?: Colis[];
  clientNom?: string; // Pour compatibilité avec les composants existants
  codeBarre?: string;
  nomDestinataire?: string;
  telephone?: string;
  prix?: number;
  numeroCommande?: string;
}

export interface Colis {
  id?: string;
  commandeId?: string;
  clientId?: string;
  destinataireId?: string;
  depotId?: string;
  poids: number;
  dimensions?: string;
  fragile?: boolean;
  statut: string; // EN_ATTENTE, NON_SERIEUX, A_VERIFIER, A_ENLEVER, ENLEVE, AU_DEPOT, RETOUR_DEPOT, EN_TRANSIT, LIVRE, LIVRE_PAYE, ECHANGE, REMBOURSE
}

export interface Destinataire {
  id?: string;
  nom: string;
  telephone: string;
  adresseId?: string;
}

export interface Manifeste {
  id?: string;
  clientId: string;
  nombreColis: number;
  statut: string; // BROUILLON, IMPRIME, CLOTURE
  colisIds?: string[];
  dateCreation?: string;
}

export interface Enlevement {
  id?: string;
  clientId: string;
  manifesteId: string;
  livreurId?: string;
  dateDemandee: string;
  dateReelle?: string;
  statut: string; // EN_ATTENTE, PLANIFIE, EFFECTUE, ANNULE
  adresseEnlevementId: string;
}

export interface Livreur {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  gouvernorat?: string;
  typePermis?: string;
  statut: string; // DISPONIBLE, EN_COURSE, HORS_LIGNE, INSCRIPTION, SUSPENDU
  latitudeActuelle?: number;
  longitudeActuelle?: number;
  depotId?: string;
  vehiculeId?: string;
  noteMoyenne?: number;
  nombreLivraisons?: number;
  dateInscription?: string;
}

export interface Livraison {
  id: string;
  colisId: string;
  commandeId?: string; // Pour compatibilité avec les composants existants
  livreurId: string;
  statut: string; // AFFECTEE, EN_COURS, LIVREE, ECHOUEE
  dateAffectation?: string;
  dateDebut?: string;
  dateFin?: string;
  distanceKm?: number;
}

export interface PositionTracking {
  id?: string;
  livraisonId: string;
  latitude: number;
  longitude: number;
  horodatage: string;
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
  commandeId: string;
  livreurId: string;
  score: number;
  dateCalcul: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private commandesUrl = environment.apiUrl;
  private livreursUrl = environment.livreursUrl;
  private trackingUrl = environment.trackingUrl;
  private iaUrl = environment.iaUrl;
  private adressesUrl = environment.adressesUrl;

  constructor(private http: HttpClient) {}

  // --- Adresses ---
  creerAdresse(adresse: Adresse): Observable<Adresse> {
    return this.http.post<Adresse>(this.adressesUrl, adresse);
  }

  getAdresseById(id: string): Observable<Adresse> {
    return this.http.get<Adresse>(`${this.adressesUrl}/${id}`);
  }

  getAllAdresses(): Observable<Adresse[]> {
    return this.http.get<Adresse[]>(this.adressesUrl);
  }

  updateAdresse(id: string, adresse: Adresse): Observable<Adresse> {
    return this.http.put<Adresse>(`${this.adressesUrl}/${id}`, adresse);
  }

  deleteAdresse(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adressesUrl}/${id}`);
  }

  // --- Commandes ---
  creerCommande(commande: Commande): Observable<Commande> {
    return this.http.post<Commande>(`${this.commandesUrl}/commandes`, commande);
  }

  getCommandeById(id: string): Observable<Commande> {
    return this.http.get<Commande>(`${this.commandesUrl}/commandes/${id}`);
  }

  getAllCommandes(): Observable<Commande[]> {
    return this.http.get<Commande[]>(`${this.commandesUrl}/commandes`);
  }

  getCommandesByClient(clientId: string): Observable<Commande[]> {
    return this.http.get<Commande[]>(`${this.commandesUrl}/commandes/client/${clientId}`);
  }

  updateCommandeStatut(id: string, statut: string): Observable<Commande> {
    return this.http.patch<Commande>(`${this.commandesUrl}/commandes/${id}/statut`, null, {
      params: new HttpParams().set('statut', statut)
    });
  }

  deleteCommande(id: string): Observable<void> {
    return this.http.delete<void>(`${this.commandesUrl}/commandes/${id}`);
  }

  // --- Colis ---
  creerColis(colis: Colis): Observable<Colis> {
    return this.http.post<Colis>(`${this.commandesUrl}/colis`, colis);
  }

  getColisById(id: string): Observable<Colis> {
    return this.http.get<Colis>(`${this.commandesUrl}/colis/${id}`);
  }

  getColisByCommande(commandeId: string): Observable<Colis[]> {
    return this.http.get<Colis[]>(`${this.commandesUrl}/colis/commande/${commandeId}`);
  }

  getColisByClient(clientId: string): Observable<Colis[]> {
    return this.http.get<Colis[]>(`${this.commandesUrl}/colis/client/${clientId}`);
  }

  // --- Destinataires ---
  creerDestinataire(destinataire: Destinataire): Observable<Destinataire> {
    return this.http.post<Destinataire>(`${this.commandesUrl}/destinataires`, destinataire);
  }

  getDestinataireById(id: string): Observable<Destinataire> {
    return this.http.get<Destinataire>(`${this.commandesUrl}/destinataires/${id}`);
  }

  getAllDestinataires(): Observable<Destinataire[]> {
    return this.http.get<Destinataire[]>(`${this.commandesUrl}/destinataires`);
  }

  // --- Manifestes ---
  creerManifeste(manifeste: Manifeste): Observable<Manifeste> {
    return this.http.post<Manifeste>(`${this.commandesUrl}/manifestes`, manifeste);
  }

  getManifesteById(id: string): Observable<Manifeste> {
    return this.http.get<Manifeste>(`${this.commandesUrl}/manifestes/${id}`);
  }

  getAllManifestes(): Observable<Manifeste[]> {
    return this.http.get<Manifeste[]>(`${this.commandesUrl}/manifestes`);
  }

  getManifestesByClient(clientId: string): Observable<Manifeste[]> {
    return this.http.get<Manifeste[]>(`${this.commandesUrl}/manifestes/client/${clientId}`);
  }

  getBrouillonManifeste(clientId: string): Observable<Manifeste> {
    return this.http.get<Manifeste>(`${this.commandesUrl}/manifestes/client/${clientId}/brouillon`);
  }

  validerManifeste(id: string): Observable<Manifeste> {
    return this.http.patch<Manifeste>(`${this.commandesUrl}/manifestes/${id}/valider`, null);
  }

  updateManifeste(id: string, manifeste: Manifeste): Observable<Manifeste> {
    return this.http.put<Manifeste>(`${this.commandesUrl}/manifestes/${id}`, manifeste);
  }

  deleteManifeste(id: string): Observable<void> {
    return this.http.delete<void>(`${this.commandesUrl}/manifestes/${id}`);
  }

  // --- Enlèvements ---
  creerEnlevement(enlevement: Enlevement): Observable<Enlevement> {
    return this.http.post<Enlevement>(`${this.commandesUrl}/enlevements`, enlevement);
  }

  getEnlevementById(id: string): Observable<Enlevement> {
    return this.http.get<Enlevement>(`${this.commandesUrl}/enlevements/${id}`);
  }

  getEnlevementsByClient(clientId: string): Observable<Enlevement[]> {
    return this.http.get<Enlevement[]>(`${this.commandesUrl}/enlevements/client/${clientId}`);
  }

  getEnlevementsByLivreur(livreurId: string): Observable<Enlevement[]> {
    return this.http.get<Enlevement[]>(`${this.commandesUrl}/enlevements/livreur/${livreurId}`);
  }

  // --- Livreurs ---
  creerLivreur(livreur: Livreur): Observable<Livreur> {
    return this.http.post<Livreur>(`${this.livreursUrl}/livreurs`, livreur);
  }

  getLivreurById(id: string): Observable<Livreur> {
    return this.http.get<Livreur>(`${this.livreursUrl}/livreurs/${id}`);
  }

  getAllLivreurs(): Observable<Livreur[]> {
    return this.http.get<Livreur[]>(`${this.livreursUrl}/livreurs`);
  }

  getLivreursDisponibles(): Observable<Livreur[]> {
    return this.http.get<Livreur[]>(`${this.livreursUrl}/livreurs/statut/DISPONIBLE`);
  }

  getLivreursByGouvernorat(gouvernorat: string): Observable<Livreur[]> {
    return this.http.get<Livreur[]>(`${this.livreursUrl}/livreurs/gouvernorat/${gouvernorat}`);
  }

  updateLivreurStatut(id: string, statut: string): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/statut`, null, {
      params: new HttpParams().set('statut', statut)
    });
  }

  updateLivreur(id: string, livreur: Partial<Livreur>): Observable<Livreur> {
    return this.http.put<Livreur>(`${this.livreursUrl}/livreurs/${id}`, livreur);
  }

  deleteLivreur(id: string): Observable<void> {
    return this.http.delete<void>(`${this.livreursUrl}/livreurs/${id}`);
  }

  updateLivreurPosition(id: string, lat: number, lon: number): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/position`, null, {
      params: new HttpParams().set('latitude', lat.toString()).set('longitude', lon.toString())
    });
  }

  // --- Livraisons & Tracking ---
  creerLivraison(colisId: string, livreurId: string): Observable<Livraison> {
    return this.http.post<Livraison>(`${this.trackingUrl}/livraisons`, null, {
      params: new HttpParams().set('colisId', colisId).set('livreurId', livreurId)
    });
  }

  demarrerLivraison(id: string): Observable<Livraison> {
    return this.http.patch<Livraison>(`${this.trackingUrl}/livraisons/${id}/demarrer`, null);
  }

  terminerLivraison(id: string): Observable<Livraison> {
    return this.http.patch<Livraison>(`${this.trackingUrl}/livraisons/${id}/terminer`, null);
  }

  echouerLivraison(id: string): Observable<Livraison> {
    return this.http.patch<Livraison>(`${this.trackingUrl}/livraisons/${id}/echouer`, null);
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

  getLivraisonsByColis(colisId: string): Observable<Livraison[]> {
    return this.http.get<Livraison[]>(`${this.trackingUrl}/livraisons/colis/${colisId}`);
  }

  // --- Position Tracking ---
  ajouterPosition(livraisonId: string, latitude: number, longitude: number): Observable<PositionTracking> {
    return this.http.post<PositionTracking>(`${this.trackingUrl}/tracking`, null, {
      params: new HttpParams().set('livraisonId', livraisonId).set('latitude', latitude.toString()).set('longitude', longitude.toString())
    });
  }

  getPositions(livraisonId: string): Observable<PositionTracking[]> {
    return this.http.get<PositionTracking[]>(`${this.trackingUrl}/tracking/livraison/${livraisonId}`);
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
    commandeId: string,
    latColis?: number,
    longColis?: number,
    livreurs: Livreur[] = []
  ): Observable<AffectationIA> {
    let params = new HttpParams().set('commandeId', commandeId);
    if (latColis !== undefined) params = params.set('latColis', latColis.toString());
    if (longColis !== undefined) params = params.set('longColis', longColis.toString());

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
