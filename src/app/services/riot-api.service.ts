import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';  // <-- Importer switchMap

@Injectable({
  providedIn: 'root'
})
export class RiotApiService {

  // URL de base de ton backend proxy
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getpezzosList(): Observable<any[]> {
    return this.http.get<any[]>('assets/pezzos.json');  // Chemin vers ton fichier JSON
  }

  // Méthode pour récupérer les informations du summoner par RiotID + tagLine
  getSummonerByRiotId(gameName: string, tagLine: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/riotid/${gameName}/${tagLine}`);
  }

  // Méthode pour récupérer le classement SoloQ du summoner
  getSummonerRank(puuid: string): Observable<any> {
    // On commence par récupérer les informations du summoner via le PUUID
    return this.http.get<any>(`${this.baseUrl}/summoner/by-puuid/${puuid}`).pipe(
      // Puis, on récupère le rank avec l'encryptedSummonerId
      switchMap(summonerData => {
        const summonerId = summonerData.id;  // Récupérer l'encryptedSummonerId
        return this.http.get<any>(`${this.baseUrl}/summoner/rank/${summonerId}`);
      })
    );
  }

  // Méthode pour récupérer l'historique des matchs par PUUID
  getSummonerMatchHistory(puuid: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/summoner/matches/${puuid}`);
  }

  // Méthode pour récupérer les infos du summoner via PUUID (existant)
  getSummonerByPuuid(puuid: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/summoner/by-puuid/${puuid}`);
  }
  // Nouvelle méthode pour vérifier si un summoner est en partie
  getSummonerLiveMatch(puuid: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/summoner/livematches/${puuid}`);
  }
}
