# Bot VIP classique

Bot Telegram déterministe et panneau local pour présenter un accès VIP sans utiliser d’IA. Chaque personne avance avec des boutons à travers une suite de textes, photos ou vidéos configurables.

## Ce que fait le bot

- envoie une photo ou une vidéo avec un texte et des boutons ;
- envoie des messages vocaux OGG/OPUS, MP3 ou M4A avec les états Telegram `record_voice` puis `upload_voice` ;
- ouvre l’étape suivante, le canal de preuves, la page Stripe ou le contact privé ;
- ajoute `client_reference_id=tg_<chatId>` au Payment Link Stripe ;
- détecte le bouton « J’ai payé », une déclaration explicite ou une capture envoyée après l’étape de paiement ;
- transmet la preuve au chat opérateur et place la personne dans « À vérifier » ;
- envoie le lien VIP seulement après un webhook Stripe signé ou une validation opérateur authentifiée ;
- ne stocke pas le texte intégral des messages ni les données de carte.

Une capture d’écran n’est jamais une preuve de paiement suffisante. Elle déclenche uniquement une vérification humaine.

## Lancer en local

Prérequis : Node.js 22 ou plus récent.

1. Double-cliquer sur `LANCER-BOT-VIP.cmd`.
2. Ouvrir <http://127.0.0.1:8791/> puis « Connexions ».
3. Coller le token obtenu auprès de `@BotFather` et choisir « Tester et activer ».
4. Envoyer `/id` au nouveau bot depuis ton compte opérateur.
5. Ajouter l’identifiant reçu dans le même écran puis réactiver.

Le panneau teste le token auprès de Telegram avant de le sauvegarder dans `.env`. Le token actif n’est jamais renvoyé au navigateur ; le champ reste vide après l’enregistrement.

Le panneau est accessible sans jeton uniquement parce qu’il écoute par défaut sur `127.0.0.1`. Ajoute toujours un long `ADMIN_TOKEN` avant de l’exposer derrière un domaine ou un tunnel.

## Configuration Stripe

1. Créer un Payment Link Stripe avec un prix récurrent mensuel.
2. Vérifier dans Stripe que la résiliation et les e-mails/reçus correspondent réellement au texte affiché dans le parcours.
3. Coller le Payment Link dans « Offre & liens ».
4. Pour une validation automatique, publier le service sur une adresse HTTPS et déclarer :

   `https://ton-domaine.example/webhooks/stripe`

5. Écouter au minimum :

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`

6. Copier le secret de signature `whsec_...` dans `STRIPE_WEBHOOK_SECRET` puis redémarrer.

Stripe documente que `client_reference_id` peut être ajouté à l’URL d’un Payment Link et qu’il est renvoyé dans `checkout.session.completed`. Le bot utilise cette référence pour associer le paiement au bon compte Telegram sans exposer de secret : [suivre un Payment Link](https://docs.stripe.com/payment-links/url-parameters?locale=fr-FR).

La livraison automatique repose sur les événements signés de Stripe, pas sur ce qu’écrit le client : [abonnements Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions).

## Personnaliser le parcours

Dans « Parcours » :

- ajoute, duplique, déplace ou supprime des étapes ;
- modifie tous les textes et libellés ;
- importe des JPG, PNG, WEBP, MP4, OGG/OPUS, MP3 ou M4A ;
- choisis une action pour chaque bouton ;
- observe le rendu dans l’aperçu téléphone ;
- enregistre puis utilise « Envoyer un test ».

Dans « Offre & liens » :

- configure ton `@` Telegram ;
- le Payment Link Stripe ;
- le canal de preuves ;
- le lien d’invitation VIP envoyé après validation ;
- les réponses automatiques avant et après vérification.

## Réception Telegram

Le projet utilise le long polling Telegram en local. Telegram ne permet pas d’utiliser simultanément `getUpdates` et un webhook sur le même bot. Au démarrage, ce projet retire donc le webhook de **ce token** sans supprimer les mises à jour en attente. Voir la [Bot API officielle](https://core.telegram.org/bots/api) et la [FAQ Telegram](https://core.telegram.org/bots/faq).

Pour un média vocal, Telegram recommande `sendVoice`. Le bot affiche d’abord l’action `record_voice`, puis `upload_voice`, avant l’envoi du fichier : [sendVoice et sendChatAction](https://core.telegram.org/bots/api#sendvoice).

## File prospects

- le panneau actualise automatiquement les prospects toutes les 5 secondes ;
- une demande répétée « J’ai payé » ne renvoie pas plusieurs alertes ;
- une même capture n’est transférée qu’une fois ;
- la recherche accepte le prénom, le `@` ou l’identifiant Telegram ;
- une panne de notification opérateur n’efface jamais la demande : elle reste visible dans « À vérifier ».

## Données locales

- `data/state.json` : parcours, prospects, états et file Stripe ;
- `data/media/` : médias importés ;
- `data/service.stdout.log` et `data/service.stderr.log` : événements techniques sans messages clients ni secrets.

Sauvegarde régulièrement le dossier `data`. Ne publie jamais `.env`.

## Tests

```powershell
npm test
```

Les tests couvrent la référence Stripe, la signature du webhook, la mise en revue idempotente d’une capture, l’interdiction de valider un paiement depuis le chat, la sauvegarde des réglages Telegram et l’ordre des actions d’un vocal.
