export const DEFAULT_FUNNEL = {
  "brandName": "Emma · accès privé",
  "creatorUsername": "@emmattvv",
  "paymentLink": "https://buy.stripe.com/bIY8wH44w9UlbHa289",
  "proofChannelLink": "https://t.me/emmapreuve",
  "vipInviteLink": "",
  "priceText": "35 € / mois · une seule formule · tout compris · sans engagement",
  "claimReply": "J’ai bien reçu ta demande 💌 Je ne valide rien sur une capture seule. Écris-moi ici pendant que je vérifie le paiement :",
  "verifiedReply": "C’est bon, ton paiement est confirmé 💗 Bienvenue dans mon espace VIP.",
  "adultNotice": "Réservé aux personnes majeures (18+).",
  "steps": [
    {
      "id": "welcome",
      "active": true,
      "title": "Bienvenue chez Emma",
      "text": "<b>Coucou, moi c’est Emma 💗</b>\n\nJ’ai préparé ce petit parcours pour te montrer ce qui se cache dans mon VIP… et ce qu’on pourrait partager tous les deux.\n\n<i>Tu me suis ?</i>",
      "mediaType": "photo",
      "media": "/media/portrait-emma.jpg",
      "buttons": [
        {
          "label": "Je te suis 💌",
          "action": "next",
          "target": "why-bot"
        }
      ]
    },
    {
      "id": "why-bot",
      "active": true,
      "title": "Pourquoi ce bot",
      "text": "<b>Pourquoi ce petit bot ? 😅</b>\n\nJe recevais trop de messages de mecs qui parlaient pendant des heures, réclamaient des photos, puis disparaissaient. Je suis humaine, mon temps et mon attention comptent aussi.\n\nAlors je garde mon énergie pour ceux qui ont vraiment envie d’entrer dans mon univers.",
      "mediaType": "photo",
      "media": "/media/portrait-emma-2.jpg",
      "buttons": [
        {
          "label": "Montre-moi un aperçu 👀",
          "action": "next",
          "target": "teaser-hook-one"
        }
      ]
    },
    {
      "id": "teaser-hook-one",
      "active": true,
      "title": "Un tout petit aperçu",
      "text": "<b>Je vais te montrer juste un petit bout de mon univers… 👀</b>\n\nIci, je reste encore sage. La suite, je la garde pour ceux qui ont vraiment envie de venir me connaître.\n\n<i>Tu veux que je t’en montre un peu plus ?</i>",
      "mediaType": "photo",
      "media": "/media/apercu-emma.jpg",
      "buttons": [
        {
          "label": "Oui, encore un peu 🙈",
          "action": "next",
          "target": "teaser-hook-two"
        }
      ]
    },
    {
      "id": "teaser-hook-two",
      "active": true,
      "title": "La suite est plus privée",
      "text": "<b>Imagine recevoir une petite attention rien que pour toi… 🙈</b>\n\nUne photo qui arrive au bon moment. Un message le soir. Puis notre délire qui devient de plus en plus naturel.\n\n<i>Et là, tu n’as encore vu que l’entrée.</i>",
      "mediaType": "photo",
      "media": "/media/apercu-lingerie-emma-2.jpg",
      "buttons": [
        {
          "label": "Explique-moi ton VIP 💗",
          "action": "next",
          "target": "vip-explained"
        }
      ]
    },
    {
      "id": "vip-explained",
      "active": true,
      "title": "Le VIP, c’est quoi ?",
      "text": "<b>Le VIP, c’est un abonnement à 35 €, sans engagement.</b>\n\n🔐 Tu entres dans mon canal Telegram privé\n🔞 Tu découvres mes photos très explicites et mes sextapes\n💌 Tu peux venir discuter et échanger avec moi en privé\n\n<i>Une seule formule. Tout est compris.</i>",
      "mediaType": "photo",
      "media": "/media/miroir-emma-1.jpg",
      "buttons": [
        {
          "label": "Découvrir la suite 💗",
          "action": "next",
          "target": "grade-one"
        }
      ]
    },
    {
      "id": "weekly-content",
      "active": true,
      "title": "Avant-goût vidéo 1 · à compléter",
      "text": "<b>Chaque semaine dans le canal privé 👇</b>\n\n🔞 Photos et nudes très explicites : +150\n🎥 Sextapes solo ou accompagnée : +50\n💌 Contenus inspirés de vos fantasmes : à l'infini\n\n<i>Je garde aussi quelques surprises pour les membres 💗</i>",
      "mediaType": "video",
      "media": "/media/758183e5-a128-4222-b617-7addcf499bce.mp4",
      "buttons": [
        {
          "label": "Et pour discuter avec toi ?",
          "action": "next",
          "target": "grade-one"
        }
      ]
    },
    {
      "id": "grade-one",
      "active": true,
      "title": "Ce qui t’attend",
      "text": "<b>Ce qui t’attend derrière le bouton 💗</b>\n\nTu entres dans mon petit jardin secret, tu découvres tout ce que je réserve au canal et tu peux venir me parler en privé.\n\nOn apprend à se connaître doucement, on partage nos journées… puis on voit où notre complicité nous emmène 😇",
      "mediaType": "photo",
      "media": "/media/2b4dc95e-7d60-4012-b627-9359a86c154e.jpg",
      "buttons": [
        {
          "label": "Pourquoi 35 € ?",
          "action": "next",
          "target": "upgrades"
        }
      ]
    },
    {
      "id": "upgrades",
      "active": true,
      "title": "Pourquoi 35 € ?",
      "text": "<b>Pourquoi 35 € ?</b>\n\nTu vois parfois un abonnement à 10 € qui semble intéressant… puis :\n📸 une photo à 20 €\n🎥 une vidéo à 50 €\n🔥 une sextape à 100 €\n\nAu final, ça peut revenir à plusieurs centaines d’euros.\n\n<b>Avec moi : 35 €, tout compris et en illimité pendant ton accès.</b>",
      "mediaType": "photo",
      "media": "/media/9fbf6189-3116-4361-a14c-7e2a498790b6.jpg",
      "buttons": [
        {
          "label": "Et entre nous deux ?",
          "action": "next",
          "target": "private-exchanges"
        }
      ]
    },
    {
      "id": "private-exchanges",
      "active": true,
      "title": "Rien que toi et moi",
      "text": "<b>Dans notre petit coin privé 🔥</b>\n\n💌 Photos privées, nudes et discussions coquines\n📞 Appels et cams coquines\n🎭 Domination, soumission et jeux de rôle\n🎥 Sextapes solo, lesbiennes ou à plusieurs\n\nTu as un fantasme ou une idée de vidéo ? Raconte-moi. Si ça me plaît et respecte mes limites, ça pourra m’inspirer pour un prochain contenu 😇\n\n<b>Tout est compris</b>, toujours entre adultes consentants.",
      "mediaType": "photo",
      "media": "/media/83603038-b220-40e5-9c82-169b86d274a6.jpg",
      "buttons": [
        {
          "label": "Fais-moi rêver 🙈",
          "action": "next",
          "target": "surprises"
        }
      ]
    },
    {
      "id": "surprises",
      "active": true,
      "title": "Imagine un peu…",
      "text": "<b>Imagine un peu… 🙈</b>\n\nTu rentres chez toi, tu ouvres Telegram et tu découvres ce que j’ai posté dans le canal. Plus tard, on se retrouve en privé, on parle de ta journée, on se taquine… et parfois une petite surprise arrive juste pour toi.\n\n<i>C’est cette bulle à nous que j’ai envie de créer. Une complicité qui continue bien après avoir regardé les photos.</i>",
      "mediaType": "photo",
      "media": "/media/87136fa4-e253-48e2-bc63-62cf64709355.jpg",
      "buttons": [
        {
          "label": "Je veux voir les avis",
          "action": "next",
          "target": "trust"
        }
      ]
    },
    {
      "id": "trust",
      "active": true,
      "title": "Ne me crois pas sur parole",
      "text": "<b>Ne me crois pas seulement sur parole 💗</b>\n\nRegarde les avis dans mon canal de preuves. Tu verras vite que je suis une vraie petite ange quand on me traite bien.\n\nLe VIP est à <b>35 €, sans engagement</b>. Tu arrêtes quand tu veux. Le paiement passe par Stripe et je ne te demanderai jamais tes données bancaires dans Telegram.",
      "mediaType": "photo",
      "media": "/media/7c094a01-6c06-42ae-a487-393c78c1cc1c.jpg",
      "buttons": [
        {
          "label": "Voir les preuves",
          "action": "proof",
          "target": ""
        },
        {
          "label": "J’ai envie de te rejoindre",
          "action": "next",
          "target": "join"
        }
      ]
    },
    {
      "id": "join",
      "active": true,
      "title": "Je te garde une place ?",
      "text": "<b>Je te garde une place ? 💗</b>\n\n35 € pour entrer dans mon canal, profiter de tout mon contenu adulte explicite en illimité, sextapes comprises, et vivre cette complicité avec moi. Le tout sans engagement.\n\nAprès le paiement, reviens ici et appuie sur « J’ai payé ». Je vérifie et je t’envoie ton accès.",
      "mediaType": "video",
      "media": "/media/5137809a-02a5-4c39-bdfb-5d5af11137a6.mp4",
      "buttons": [
        {
          "label": "Rejoindre mon VIP · 35 €",
          "action": "payment",
          "target": ""
        },
        {
          "label": "Voir les preuves",
          "action": "proof",
          "target": ""
        },
        {
          "label": "Encore un peu plus ?",
          "action": "next",
          "target": "teaser-two"
        }
      ]
    },
    {
      "id": "teaser-two",
      "active": true,
      "title": "Avant-goût vidéo 2 · à importer",
      "text": "<b>Tu en veux encore un peu ? 🔥</b>\n\nJe te laisse ce deuxième avant-goût… juste assez pour faire travailler ton imagination.\n\n<i>Le reste nous attend dans mon petit coin privé.</i>",
      "mediaType": "video",
      "media": "/media/1c904398-df33-4a27-a3b5-ec7bee82d5df.mp4",
      "buttons": [
        {
          "label": "Rejoindre mon VIP · 35 €",
          "action": "payment",
          "target": ""
        },
        {
          "label": "Voir les preuves",
          "action": "proof",
          "target": ""
        },
        {
          "label": "Me contacter (Uniquement avec le screen de paiement )",
          "action": "contact",
          "target": ""
        }
      ]
    }
  ]
};

export function initialState() {
  return {
    version: 1,
    config: structuredClone(DEFAULT_FUNNEL),
    leads: {},
    jobs: [],
    telegramOffset: 0,
    processedStripeEvents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
