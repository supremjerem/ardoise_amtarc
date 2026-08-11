# Handoff: Ardoise AMTARC (gestion des dettes du club)

## Overview
Web app pour un club de tir (AMTARC) qui remplace le carnet papier utilisé pour noter les dettes au bar/cafétéria du club (bières, eau, snacks…). Deux usages :
- Un **membre** consulte sa propre ardoise (solde dû, historique).
- Un ou plusieurs **responsables de caisse (admin)** gèrent tous les membres : ajoutent des dépenses/paiements, gèrent la fiche membre, suivent les plafonds de dette, exportent le grand livre.

Doit fonctionner correctement sur mobile (Android/iOS, navigateur) et desktop, sans installation d'app native — c'est le point de départ du projet.

## About the Design Files
Le fichier `design_reference.html` dans ce dossier est une **maquette interactive** (référence de design, pas du code de production) : un unique fichier HTML qui simule tout le flux avec des données de démonstration stockées dans le localStorage du navigateur. Il n'y a **aucun backend réel, aucune base de données, aucune authentification sécurisée** derrière cette maquette.

La tâche : **recréer ce design et ces comportements dans une vraie stack** (à choisir — voir "Choix technique" ci-dessous), avec un vrai backend, une vraie base de données et une authentification appropriée. Ne pas copier le HTML tel quel.

## Fidelity
**Haute fidélité (hifi)** : couleurs, typographie, espacements et interactions ci-dessous sont ceux à reproduire pixel pour pixel. Le contenu de démo (les 9 membres, montants, dates) est fictif — à remplacer par de vraies données.

## Choix technique
Aucune stack n'est imposée : c'est à décider en développant avec Claude Code. Points à trancher tôt (le PRD ci-dessous est indépendant de ce choix) :
- Frontend web app responsive (mobile + desktop) — framework au choix (React, Vue, Svelte, etc.), ou un framework fullstack (Next.js, Remix…).
- Backend + base de données réelle (les soldes et l'historique doivent survivre au-delà d'un navigateur/appareil — actuellement seul point faible de la maquette).
- Authentification : la maquette utilise un PIN à 4 chiffres par personne à des fins de démo uniquement. **Ce n'est pas un mécanisme sécurisé** pour la production — à repenser (mot de passe, magic link, PIN + hash côté serveur avec limitation des tentatives, etc.) en gardant l'esprit "ultra simple, pas de friction" voulu pour un public senior peu à l'aise avec la technologue.
- Hébergement : simple, pas d'app store — un déploiement web classique (Vercel, Netlify, VPS…) convient.

## Rôles & permissions
- **Membre** : voit uniquement son propre solde et son propre historique. Ne peut rien modifier.
- **Responsable de caisse (admin)** : voit tous les membres et leurs soldes, ajoute/modifie/supprime des transactions, gère les fiches membres (création, édition, suppression), gère les autres comptes admin, règle le plafond d'alerte, exporte le grand livre. Un admin est aussi un membre — il a sa propre ardoise personnelle et peut basculer entre "vue caisse" et "mon ardoise".
- Plusieurs comptes admin nommés doivent pouvoir coexister (pas un compte partagé) : chaque action de caisse est tracée à un responsable identifié.

## Modèle de données
**Member**
| champ | type | notes |
|---|---|---|
| id | string/uuid | |
| name | string | prénom + nom |
| licenceNumber | string, optionnel | numéro de licence/abonné du club |
| email | string, optionnel | |
| phone | string, optionnel | |
| photoUrl | string, optionnel | photo de profil |
| isAdmin | boolean | responsable de caisse ou non |
| pin / credentials | — | à sécuriser côté serveur, jamais en clair |
| cap | number | plafond de dette en euros avant alerte, propre à chaque membre (défaut réglable globalement) |

**Transaction**
| champ | type | notes |
|---|---|---|
| id | string/uuid | |
| memberId | string | |
| kind | enum: `debit` \| `credit` \| `reminder` | debit = dépense (augmente la dette), credit = paiement reçu (diminue la dette), reminder = rappel envoyé (montant 0, juste un log) |
| amount | number | en euros, toujours positif ; le signe est déterminé par `kind` |
| note | string, optionnel | libellé libre (ex: "Bières", "Règlement espèces") — pas de détail article par article, un solde global suffit |
| date | date | |
| createdBy | string (memberId de l'admin) | traçabilité |

**Solde d'un membre** = somme(debit) − somme(credit) sur toutes ses transactions. Un `reminder` n'affecte jamais le solde.
**Alerte plafond** : solde > cap du membre.

**Réglages globaux**
- `defaultCap` : plafond par défaut appliqué aux nouveaux membres (modifiable dans Réglages).

## Écrans

### 1. Connexion
- Étape 1 — "Qui êtes-vous ?" : liste de tous les membres (avatar initiales + nom), badge "Responsable" sur les comptes admin. Clic → étape 2.
- Étape 2 — Saisie PIN : avatar + nom de la personne sélectionnée, 4 points indicateurs, pavé numérique tactile (1-9, 0, effacer), lien "← Retour". Code correct → connexion (admin arrive sur le tableau de bord, membre sur son ardoise). Code incorrect → message d'erreur + petite animation de secousse, champ réinitialisé.

### 2. Mon ardoise (vue membre — utilisée par un membre normal, ou par un admin qui bascule en "Mon ardoise")
- En-tête : avatar, nom, n° de licence, bouton déconnexion (+ bouton "Vue caisse" si la personne est admin).
- Carte de solde : statut ("À régler" / "Compte à jour" / "Avoir en votre faveur"), montant en gros, barre de progression par rapport au plafond.
- Bandeau d'alerte si le plafond est dépassé.
- Liste "Historique" des transactions (libellé, date, montant signé coloré). État vide : "Aucune transaction pour l'instant."

### 3. Tableau de bord (vue admin, écran d'accueil des responsables)
- En-tête club + boutons "Mon ardoise", "Réglages", "Déconnexion".
- Deux indicateurs : "Total dû" (somme des soldes positifs), "Au-dessus du plafond" (nombre de membres en alerte).
- Barre de recherche (nom ou n° de licence) + bouton "+ Membre".
- Liste des membres triée par solde décroissant : avatar, nom, licence, solde coloré. Clic → détail membre.
- Bouton flottant "+" en bas à droite → ouvre la fenêtre "Nouvelle transaction" (membre à choisir dans un sélecteur).

### 4. Détail membre (vue admin)
- Retour, nom, bouton "Modifier".
- Fiche : avatar, licence, email, téléphone, solde, plafond.
- Bandeau d'alerte si plafond dépassé.
- Actions : "+ Ajouter une dépense", "✓ Enregistrer un paiement" (préremplissent la fenêtre "Nouvelle transaction" avec ce membre), "Envoyer un rappel" (log une notification), "Supprimer" (le membre, avec confirmation).
- Historique complet des transactions de ce membre, chaque ligne supprimable (icône ✕, avec confirmation).

### 5. Réglages (vue admin)
- Plafond par défaut (input numérique).
- Liste des comptes responsables de caisse + bouton "+ Ajouter" (ouvre la fenêtre membre avec "Responsable de caisse" pré-activé).
- Bouton "Imprimer / exporter" le grand livre (impression / export PDF).

### Fenêtres modales
- **Nouvelle transaction** : sélection du membre, type (Dépense / Paiement, boutons toggle), montant, note optionnelle, Annuler/Enregistrer.
- **Nouveau/Modifier membre** : photo (upload, cercle avec pointillés, initiales en repli), nom complet, n° de licence, plafond, email, téléphone, interrupteur "Responsable de caisse", code PIN, Annuler/Enregistrer, bouton "Supprimer ce membre" si édition.
- **Confirmation** générique (suppression membre / transaction) : message + Annuler/Confirmer.
- **Toast** : petit message en bas de l'écran après chaque action (ajout, suppression, erreur…), auto-disparition après ~2,5s.

## Interactions & comportements clés
- Connexion : le PIN se valide automatiquement au 4ᵉ chiffre (pas de bouton "Valider").
- Toutes les fenêtres modales se ferment en cliquant sur le fond sombre, sans fermer si on clique dans la carte elle-même.
- Les listes se trient/filtrent en direct (recherche membre, tri par solde).
- Toute action de caisse (transaction, suppression, ajout membre) déclenche un toast de confirmation.
- Aucune animation complexe : transitions courtes (~150-200ms) sur l'ouverture des modales et l'apparition des toasts.

## Design Tokens
**Couleurs**
- Fond app : `oklch(97% 0.012 75)` (blanc chaud, neutre)
- Surfaces (cartes) : `#FFFFFF`
- Texte principal / graphite : `#2B2F33`
- Texte secondaire : `oklch(55% 0.01 75)`
- Accent principal (CTA, avatar admin, bouton "+") : `oklch(68% 0.15 55)` (ambre chaleureux)
- Dette / danger : `oklch(52-58% 0.16-0.18 25)` (rouge-orangé chaud)
- Paiement / succès : `oklch(55-60% 0.14 145)` (vert)
- Avoir / crédit : `oklch(52% 0.14 210)` (bleu doux)
- Avatars (palette rotative) : `#E8C9A0`, `#C9DAC8`, `#CBD5E3`, `#E3C9CE`, `#D9CBB3`

**Typographie**
- Titres / montants / marque : Poppins, 500-700
- Corps de texte / UI : Inter, 400-600
- Tailles : montant principal 44px (vue membre) / 34px (détail admin), titres d'écran 17-22px, corps 13-15px, labels 12px

**Rayons / ombres**
- Cartes : border-radius 18-20px
- Boutons / champs : border-radius 10-14px, pastilles (badges, boutons secondaires) : 20px, cercles (avatars) : 50%
- Ombre de carte : `0 1px 3px rgba(43,47,51,.06), 0 12px 28px rgba(43,47,51,.08)`
- Ombre de modale/bouton flottant : `0 8px 20px rgba(0,0,0,.18-.2)`

**Espacements** : échelle approximative 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 30px.

## Assets
Aucune image externe : avatars = initiales sur fond de couleur (ou photo uploadée par l'admin, stockée en base). Aucune icône de librairie utilisée — quelques glyphes typographiques simples (←, ✕, ✓, ⌫).

## Files
- `design_reference.html` — maquette interactive complète (à ouvrir dans un navigateur). Toute la logique de démo (calcul de solde, alertes, CRUD membres/transactions) y est implémentée en JavaScript et documente les règles métier ci-dessus.
