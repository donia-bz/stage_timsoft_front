import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Adresse {
  id?: string;
  gouvernorat: string;
  ville: string;
  localite: string;
  rue: string;
  codePostal?: string;
  telephone?: string;
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
  adresse?: string;
  ville?: string;
  dateNaissance?: string;
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

export interface Reclamation {
  id?: string;
  clientId: string;
  commandeId: string;
  type: string; // COLIS_ENDOMMAGE, RETARD, PAIEMENT, AUTRE
  description: string;
  statut: string; // EN_ATTENTE, EN_COURS, RESOLUE, REJETEE
  adminCommentaire?: string;
  dateCreation?: string;
  dateResolution?: string;
  objet?: string; // Pour compatibilité avec le frontend
  codeBarre?: string; // Pour compatibilité avec le frontend
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

export interface Vehicule {
  id?: string;
  immatriculation: string;
  marque: string;
  modele: string;
  type: string; // CAMIONNETTE, UTILITAIRE, CAMION
  capaciteKg: number;
  capaciteVolume: number;
  annee: number;
  statut: string; // DISPONIBLE, EN_SERVICE, MAINTENANCE, HORS_SERVICE
  depotId?: string;
  livreurId?: string;
}

export interface Depot {
  id?: string;
  nom: string;
  adresse: string;
  gouvernorat: string;
  telephone: string;
  capacite: number;
  capaciteActuelle: number;
  latitude?: number;
  longitude?: number;
  statut: string; // ACTIF, INACTIF
}

export interface EvaluationLivreur {
  id?: string;
  livreurId: string;
  clientId: string;
  commandeId: string;
  note: number; // 1-5
  commentaire?: string;
  date?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private commandesUrl = environment.apiUrl;
  private livreursUrl = environment.livreursUrl;
  private trackingUrl = environment.trackingUrl;
  private iaUrl = environment.iaUrl;
  private iaJavaUrl = (environment as any).iaJavaUrl || 'http://localhost:8085/api/ia';
  private adressesUrl = environment.adressesUrl;
  private vehiclesUrl = environment.vehiclesUrl;
  private depotsUrl = environment.depotsUrl;
  private reclamationsUrl = environment.reclamationsUrl;
  private statsUrl = environment.statsUrl;

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
    return this.http.patch<Commande>(`${this.commandesUrl}/commandes/${id}/statut`, { statut });
  }

  deleteCommande(id: string): Observable<void> {
    return this.http.delete<void>(`${this.commandesUrl}/commandes/${id}`);
  }

  searchCommandes(query: string): Observable<Commande[]> {
    console.log('Recherche de commandes avec query:', query);
    console.log('URL complète:', `${this.commandesUrl}/commandes/search?q=${query}`);
    return this.http.get<Commande[]>(`${this.commandesUrl}/commandes/search`, {
      params: new HttpParams().set('q', query)
    }).pipe(
      tap(
        results => console.log('Résultats API reçus:', results),
        error => console.error('Erreur API:', error)
      )
    );
  }

  // --- Règlements / Paiements ---
  getReglementsByClient(clientId: string, mois?: number, annee?: number): Observable<any[]> {
    let params = new HttpParams();
    if (mois !== undefined) params = params.set('mois', mois.toString());
    if (annee !== undefined) params = params.set('annee', annee.toString());
    return this.http.get<any[]>(`${this.commandesUrl}/paiements/client/${clientId}/reglements`, { params });
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

  searchColis(query: string): Observable<Colis[]> {
    return this.http.get<Colis[]>(`${this.commandesUrl}/colis/search`, {
      params: new HttpParams().set('q', query)
    });
  }

  updateColisStatut(id: string, statut: string): Observable<Colis> {
    return this.http.patch<Colis>(`${this.commandesUrl}/colis/${id}/statut`, null, {
      params: new HttpParams().set('statut', statut)
    });
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
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/statut`, { statut });
  }

  updateLivreur(id: string, livreur: Partial<Livreur>): Observable<Livreur> {
    return this.http.put<Livreur>(`${this.livreursUrl}/livreurs/${id}`, livreur);
  }

  assignerGouvernoratLivreur(id: string, gouvernorat: string): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/gouvernorat`, null, {
      params: new HttpParams().set('gouvernorat', gouvernorat)
    });
  }

  deleteLivreur(id: string): Observable<void> {
    return this.http.delete<void>(`${this.livreursUrl}/livreurs/${id}`);
  }

  updateLivreurPosition(id: string, lat: number, lon: number): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/position`, null, {
      params: new HttpParams().set('latitude', lat.toString()).set('longitude', lon.toString())
    });
  }

  assignerGouvernorat(id: string, gouvernorat: string): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.livreursUrl}/livreurs/${id}/gouvernorat`, null, {
      params: new HttpParams().set('gouvernorat', gouvernorat)
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

  dispatchGlobal(commandes: any[], livreurs: Livreur[]): Observable<any> {
    const payload = {
      commandes: commandes.map(c => ({
        id: c.id,
        latitude: c.latDepart || c.adresseArrivee?.latitude || 36.8,
        longitude: c.longDepart || c.adresseArrivee?.longitude || 10.1,
        poidsKg: c.poidsKg || 1.0,
        ville: c.gouvernoratDepart || c.villeDepart || "Tunis",
        gouvernorat: c.adresseArrivee?.gouvernorat || "Tunis"
      })),
      livreurs: livreurs.map(l => ({
        id: l.id,
        nom: l.nom,
        prenom: l.prenom,
        latitudeActuelle: l.latitudeActuelle || 36.8,
        longitudeActuelle: l.longitudeActuelle || 10.1,
        noteMoyenne: l.noteMoyenne || 5.0,
        gouvernorat: l.gouvernorat || "Tunis"
      }))
    };
    return this.http.post<any>(`${this.iaUrl}/dispatch-global`, payload);
  }

  // --- Véhicules ---
  getAllVehicules(): Observable<Vehicule[]> {
    return this.http.get<Vehicule[]>(`${this.vehiclesUrl}/vehicules`);
  }

  getVehiculeById(id: string): Observable<Vehicule> {
    return this.http.get<Vehicule>(`${this.vehiclesUrl}/vehicules/${id}`);
  }

  creerVehicule(vehicule: Vehicule): Observable<Vehicule> {
    return this.http.post<Vehicule>(`${this.vehiclesUrl}/vehicules`, vehicule);
  }

  updateVehicule(id: string, vehicule: Vehicule): Observable<Vehicule> {
    return this.http.put<Vehicule>(`${this.vehiclesUrl}/vehicules/${id}`, vehicule);
  }

  deleteVehicule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.vehiclesUrl}/vehicules/${id}`);
  }

  affecterVehicule(livreurId: string, vehiculeId: string): Observable<any> {
    return this.http.post<any>(`${this.livreursUrl}/livreurs/${livreurId}/vehicule`, null, {
      params: new HttpParams().set('vehiculeId', vehiculeId)
    });
  }

  desaffecterVehicule(livreurId: string): Observable<any> {
    return this.http.delete<any>(`${this.livreursUrl}/livreurs/${livreurId}/vehicule`);
  }

  // --- Dépôts ---
  getAllDepots(): Observable<Depot[]> {
    return this.http.get<Depot[]>(`${this.depotsUrl}/depots`);
  }

  getDepotById(id: string): Observable<Depot> {
    return this.http.get<Depot>(`${this.depotsUrl}/depots/${id}`);
  }

  creerDepot(depot: Depot): Observable<Depot> {
    return this.http.post<Depot>(`${this.depotsUrl}/depots`, depot);
  }

  updateDepot(id: string, depot: Depot): Observable<Depot> {
    return this.http.put<Depot>(`${this.depotsUrl}/depots/${id}`, depot);
  }

  deleteDepot(id: string): Observable<void> {
    return this.http.delete<void>(`${this.depotsUrl}/depots/${id}`);
  }

  getDepotsByGouvernorat(gouvernorat: string): Observable<Depot[]> {
    return this.http.get<Depot[]>(`${this.depotsUrl}/depots/gouvernorat/${gouvernorat}`);
  }

  // --- Réclamations ---
  getAllReclamations(): Observable<Reclamation[]> {
    return this.http.get<Reclamation[]>(`${this.reclamationsUrl}/reclamations`);
  }

  getReclamationById(id: string): Observable<Reclamation> {
    return this.http.get<Reclamation>(`${this.reclamationsUrl}/reclamations/${id}`);
  }

  creerReclamation(reclamation: Reclamation): Observable<Reclamation> {
    return this.http.post<Reclamation>(`${this.reclamationsUrl}/reclamations`, reclamation);
  }

  updateReclamation(id: string, reclamation: Reclamation): Observable<Reclamation> {
    return this.http.put<Reclamation>(`${this.reclamationsUrl}/reclamations/${id}`, reclamation);
  }

  deleteReclamation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.reclamationsUrl}/reclamations/${id}`);
  }

  updateReclamationStatut(id: string, statut: string): Observable<Reclamation> {
    return this.http.patch<Reclamation>(`${this.reclamationsUrl}/reclamations/${id}/statut`, null, {
      params: new HttpParams().set('statut', statut)
    });
  }

  getReclamationsByClient(clientId: string): Observable<Reclamation[]> {
    return this.http.get<Reclamation[]>(`${this.reclamationsUrl}/reclamations/client/${clientId}`);
  }

  getReclamationsByStatut(statut: string): Observable<Reclamation[]> {
    return this.http.get<Reclamation[]>(`${this.reclamationsUrl}/reclamations/statut/${statut}`);
  }

  // --- IA pour Réclamations ---
  analyserReclamation(reclamationId: string, description: string, typeReclamation?: string, clientId?: string, commandeId?: string, dateCreation?: string): Observable<any> {
    return this.http.post<any>(`${this.iaUrl}/api/ia/analyser-reclamation`, {
      reclamation_id: reclamationId,
      description: description,
      type_reclamation: typeReclamation,
      client_id: clientId,
      commande_id: commandeId,
      date_creation: dateCreation
    });
  }

  genererReponseReclamation(reclamationId: string, typeReponse: 'FORMELLE' | 'EMPATHIQUE' | 'TECHNIQUE', contexte?: any): Observable<any> {
    return this.http.post<any>(`${this.iaUrl}/api/ia/generer-reponse`, {
      reclamation_id: reclamationId,
      type_reponse: typeReponse,
      contexte: contexte
    });
  }

  detecterAnomaliesReclamations(reclamations: any[], periodeJours: number = 7): Observable<any> {
    return this.http.post<any>(`${this.iaUrl}/api/detect-anomalies`, {
      reclamations: reclamations,
      days: periodeJours
    });
  }

  // --- Évaluations ---
  creerEvaluation(evaluation: EvaluationLivreur): Observable<EvaluationLivreur> {
    return this.http.post<EvaluationLivreur>(`${this.statsUrl}/stats/evaluations`, evaluation);
  }

  getEvaluationById(id: string): Observable<EvaluationLivreur> {
    return this.http.get<EvaluationLivreur>(`${this.statsUrl}/stats/evaluations/${id}`);
  }

  getEvaluationsByLivreur(livreurId: string): Observable<EvaluationLivreur[]> {
    return this.http.get<EvaluationLivreur[]>(`${this.statsUrl}/stats/evaluations/livreur/${livreurId}`);
  }

  getEvaluationsByClient(clientId: string): Observable<EvaluationLivreur[]> {
    return this.http.get<EvaluationLivreur[]>(`${this.statsUrl}/stats/evaluations/client/${clientId}`);
  }

  getMoyenneNoteLivreur(livreurId: string): Observable<{ moyenne: number }> {
    return this.http.get<{ moyenne: number }>(`${this.statsUrl}/stats/evaluations/livreur/${livreurId}/moyenne`);
  }

  getAllEvaluations(): Observable<EvaluationLivreur[]> {
    return this.http.get<EvaluationLivreur[]>(`${this.statsUrl}/stats/evaluations`);
  }
}
