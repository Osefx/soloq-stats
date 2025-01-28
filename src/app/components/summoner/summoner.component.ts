import { Component, OnInit } from '@angular/core';
import { RiotApiService } from 'src/app/services/riot-api.service';
import { from, of } from 'rxjs';
import { concatMap, delay, catchError, map, tap } from 'rxjs/operators';

@Component({
  selector: 'app-summoner',
  templateUrl: './summoner.component.html',
  styleUrls: ['./summoner.component.css']
})
export class SummonerComponent implements OnInit {
  pezzosList: any[] = []; // Liste des amis
  pezzosData: any[] = []; // Données complètes pour chaque ami
  errorMessage: string = '';
  selectedMatch: any = null; // Stocke le match actuellement sélectionné

  constructor(private riotApiService: RiotApiService) {}

  ngOnInit(): void {
    // Charger la liste des amis
    this.riotApiService.getpezzosList().subscribe(
      (pezzos) => {
        this.pezzosList = pezzos;
        this.loadpezzosData();
      },
      (error) => {
        console.error('Erreur lors de la récupération de la liste des amis:', error);
        this.errorMessage = 'Erreur lors de la récupération de la liste des amis.';
      }
    );
  }

  // Méthode pour générer le lien vers le match en cours
  getLiveGameLink(gameId: number): string {
    // Exemple de lien vers un site tiers (comme OP.GG)
    return `https://www.op.gg/live/game/${gameId}`;

    // Ou un lien vers ton propre back-end pour afficher les détails du match
    // return `/live-game/${gameId}`;
  }



  // Charger les données avec un décalage entre chaque ami
  loadpezzosData(): void {
    from(this.pezzosList) // Convertir la liste des amis en un flux observable
      .pipe(
        concatMap((friend, index) => {
          return this.loadFriendData(friend).pipe(
            delay(3000), // Ajouter un délai de 3 secondes entre chaque requête
            catchError((error) => {
              console.error(`Erreur pour ${friend.gameName}:`, error);
              return of({ error: true, gameName: friend.gameName }); // Gérer les erreurs sans bloquer
            })
          );
        })
      )
      .subscribe((friendData) => {
        this.pezzosData.push(friendData); // Ajouter les données de l'ami au tableau
      });
  }

   // Charger les données pour un ami
   loadFriendData(friend: any) {
    let friendData: any = {
      gameName: friend.gameName,
      tagLine: friend.tagLine,
      opggUrl: friend.opggUrl,
      summonerData: null,
      rankData: null,
      summonerLevel: null,
      matchHistory: null,
      liveMatchData: null,  // Ajouter un champ pour les données de match en direct
      profileIconId: null,
      error: null
    };

    return this.riotApiService.getSummonerByRiotId(friend.gameName, friend.tagLine).pipe(
      concatMap((data) => {
        console.log('Summoner Data récupéré:', data);
        friendData.summonerData = data;

        return this.riotApiService.getSummonerByPuuid(data.puuid).pipe(
          concatMap((rankData) => {
            console.log('Rank Data récupéré:', rankData);
            friendData.rankData = rankData.rank;
            if (rankData && rankData.summoner) {
              friendData.profileIconId = rankData.summoner.profileIconId;
              friendData.summonerLevel = rankData.summoner.summonerLevel;
            }

            // Charger l'historique des matchs
            return this.riotApiService.getSummonerMatchHistory(data.puuid).pipe(
              concatMap((matchHistory) => {
                friendData.matchHistory = matchHistory.map((match: any) => {
                  const participant = match.info.participants.find(
                    (p: any) => p.puuid === data.puuid
                  );
                  return {
                    ...match,
                    playerStats: participant || {},
                    playerWon: !!match.info.teams.find(
                      (team: any) => team.win && team.teamId === participant?.teamId
                    ),
                    queueType: this.getQueueType(match.info.queueId)
                  };
                });

                // Maintenant, chargeons les données du match en direct
                return this.loadLiveMatchData(data.puuid).pipe(
                  map((liveMatchData) => {
                    friendData.liveMatchData = liveMatchData;  // Ajouter les données en direct
                    return friendData;
                  })
                );
              })
            );
          })
        );
      })
    );
  }


  toggleMatchDetails(match: any): void {
    match.showDetails = !match.showDetails; // Basculer l'affichage des détails
    this.selectedMatch = match; // Stocke le match sélectionné
    console.log('Match sélectionné :', match); // Debugging pour vérifier les données
  }

  // Charger les données de la partie en cours
  loadLiveMatchData(puuid: string) {
    return this.riotApiService.getSummonerLiveMatch(puuid).pipe(
      map((liveMatchData) => {
        return {
          ...liveMatchData,
          isInGame: !!liveMatchData.gameId, // Détermine si l'ami est en jeu
          gameId: liveMatchData.gameId,
          server: liveMatchData.platformId, // Exemple: EUW1
          encryptionKey: liveMatchData.observers?.encryptionKey, // Clé de spectateur
          port: liveMatchData.port || 8088 // Si le port n'est pas fourni, utiliser 8088 par défaut
        };
      }),
      catchError((error) => {
        console.error('Erreur lors de la récupération de la partie en cours:', error);
        return of({ isInGame: false }); // Valeur par défaut si pas en jeu
      })
    );
  }

  getSpectateCommand(liveMatchData: any): string {
    if (!liveMatchData || !liveMatchData.isInGame) return '';

    const { server, encryptionKey, gameId, port } = liveMatchData;

    // Chemin d'installation League of Legends (adapter selon l'utilisateur)
    const leagueClientPath = `"D:\\GAMES\\Riot Games\\League of Legends\\LeagueClient.exe"`;

    // Construire la commande spectateur
    return `${leagueClientPath} spectate ${server} ${encryptionKey} ${gameId} ${port}`;
  }
  generateSpectateScript(liveMatchData: any) {
    const spectateCommand = this.getSpectateCommand(liveMatchData);

    // Créer un fichier téléchargeable
    const blob = new Blob([spectateCommand], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'spectate_game.bat'; // .sh pour Linux/MacOS
    link.click();
  }


  // Méthode pour obtenir le type de file d'attente
  getQueueType(queueId: number): string {
    const queueMap: { [key: number]: string } = {
      400: 'Draft',
      420: 'SoloQ',
      440: 'FlexQ',
      450: 'Aram',
      700: 'Clash',
      830: 'Coop vs AI (Intro)',
      840: 'Coop vs AI (Beginner)',
      850: 'Coop vs AI (Intermediate)',
      900: 'Urf'
      // Ajoute ici d'autres queueId si nécessaire
    };

    return queueMap[queueId] || 'Classic'; // Retourne "Classic" par défaut si queueId inconnu
  }

  // Méthode pour obtenir le type de la file d'attente pour le live game
getGameMode(queueId: number): string {
  const gameModeMap: { [key: number]: string } = {
    420: 'SoloQ',
    440: 'FlexQ',
    450: 'ARAM',
    460: 'Normal',
    700: 'Clash',
    830: 'Coop vs AI (Intro)',
    840: 'Coop vs AI (Beginner)',
    850: 'Coop vs AI (Intermediate)',
    900: 'Urf'
    // Ajoute ici d'autres gameQueueConfigId si nécessaire
  };

  return gameModeMap[queueId] || 'Inconnu'; // Par défaut, 'Inconnu' si le gameQueueConfigId ne correspond à rien
}

  /**
   * Calculer le taux de victoire (Winrate)
   * @param friend Objet contenant les données de l'ami
   * @returns Le Winrate formaté en pourcentage ou 'N/A' si non calculable
   */
  getWinrate(friend: any): string {
    if (!friend.rankData || !friend.rankData[0]) {
      return 'N/A';
    }
    const wins = friend.rankData[0]?.wins || 0;
    const losses = friend.rankData[0]?.losses || 0;

    if (wins + losses === 0) {
      return 'N/A';
    }

    const winrate = (wins / (wins + losses)) * 100;
    return winrate.toFixed(2) + ' %';
  }

  getWinratePercentage(wins: number, losses: number): number {
    if (!wins || !losses) return 0;
    return (wins / (wins + losses)) * 100;
  }

  getWinrateColor(wins: number, losses: number): string {
    const winrate = this.getWinratePercentage(wins, losses);
    if (winrate >= 50) {
      return 'green';
    } else if (winrate >= 30) {
      return 'orange';
    } else {
      return 'red';
    }
  }





}
