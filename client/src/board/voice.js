// Chat vocal entre les personnes présentes sur le même board (WebRTC).
//
// ── L'idée en une image ───────────────────────────────────────────────────
//
// Le son ne passe PAS par notre serveur. Les navigateurs se parlent
// directement, d'ordinateur à ordinateur (« pair-à-pair »). Notre serveur ne
// sert qu'à les présenter l'un à l'autre, comme quelqu'un qui donnerait un
// numéro de téléphone — ensuite, la conversation ne le concerne plus.
//
// Trois mots à connaître :
//
//   • WebRTC        : la technologie intégrée aux navigateurs qui permet
//                     d'envoyer du son directement à un autre navigateur.
//   • signalisation : les quelques messages échangés AVANT l'appel pour se
//                     mettre d'accord (« voici mon adresse », « voici quel
//                     son je sais lire »). Ils passent par Socket.IO, la
//                     connexion déjà ouverte pour le dessin.
//   • STUN          : un serveur public qui répond juste « voici l'adresse
//                     sous laquelle je te vois depuis Internet ». Nécessaire
//                     car la plupart des ordinateurs sont derrière une box
//                     et ne connaissent pas leur propre adresse publique.
//   • TURN          : un serveur qui RELAIE le son quand les deux personnes
//                     n'arrivent pas à se joindre directement (réseau
//                     d'entreprise, certaines 4G, pare-feu strict). C'est le
//                     filet de sécurité : le navigateur ne s'en sert que si
//                     la connexion directe échoue. Facultatif — s'il n'est
//                     pas configuré sur le serveur, on fonctionne comme avant
//                     avec STUN seul.
//
// La liste de ces serveurs n'est PAS écrite ici : elle est demandée au
// serveur au moment de rejoindre l'appel. Les identifiants TURN sont payants
// à l'usage, ils n'ont donc rien à faire dans le code envoyé au navigateur.
//
// ── Qui appelle qui ? ─────────────────────────────────────────────────────
//
// Règle simple pour éviter que deux personnes s'appellent en même temps :
// **celui qui arrive appelle ceux qui sont déjà là.** Le serveur lui donne la
// liste des présents au moment où il rejoint ; les autres se contentent
// d'attendre son appel. Pour chaque paire, un seul des deux compose donc le
// numéro.
//
// ── « Mesh » ──────────────────────────────────────────────────────────────
//
// Chacun est relié à chacun (« mesh » = filet). À 4 participants cela fait
// 6 liaisons. C'est largement suffisant ici, et cela évite un serveur de
// mélange audio (« SFU ») qui serait très lourd à écrire.

// Liste de secours, utilisée seulement si le serveur ne répond pas. Sans
// elle, une panne de l'API empêcherait tout appel, même entre deux personnes
// sur le même réseau.
const ICE_PAR_DEFAUT = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

// De combien faut-il dépasser le bruit de fond pour qu'on considère que la
// personne parle ? Valeur volontairement basse : mieux vaut une pastille un
// peu bavarde qu'une pastille muette.
const MARGE_PAROLE = 0.012;
// Plancher absolu, pour qu'un micro très bruyant ne fasse pas pulser en
// permanence.
const SEUIL_MINIMUM = 0.008;
// On garde l'indicateur allumé un court instant après la fin du son, sinon il
// clignote entre chaque syllabe.
const MAINTIEN_MS = 400;

/**
 * Écrit une ligne dans la console du navigateur (F12 → onglet « Console »).
 *
 * Toutes les lignes commencent par « [audio] » : il suffit de taper « audio »
 * dans le filtre de la console pour ne voir que celles-ci. Ces messages
 * servent à diagnostiquer un appel qui ne marche pas, sans avoir à deviner.
 */
function journal(message) {
  console.log(`[audio] ${message}`);
}

/**
 * Mode détaillé : affiche en plus le niveau du micro, une fois par seconde.
 * Trop bavard pour être actif en permanence. Pour l'allumer, taper dans la
 * console puis recharger la page :
 *   localStorage.setItem("audio-debug", "1")
 * Pour l'éteindre :
 *   localStorage.removeItem("audio-debug")
 */
function debugActif() {
  try {
    return localStorage.getItem("audio-debug") === "1";
  } catch {
    return false; // navigation privée très stricte
  }
}

/**
 * Le navigateur sait-il faire du WebRTC ?
 *
 * Cette vérification existe pour une raison précise : nos tests d'interface
 * tournent dans un navigateur simulé (jsdom) qui ne connaît ni les micros ni
 * WebRTC. Le module doit s'y charger sans planter — le bouton audio est alors
 * simplement masqué, et tout le reste du tableau fonctionne normalement.
 */
export function voiceSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection === "function" &&
    Boolean(navigator?.mediaDevices?.getUserMedia)
  );
}

/**
 * @param {object} options
 * @param {object} options.net        connexion Socket.IO déjà ouverte (net.js)
 * @param {Function} options.loadIce  va chercher la liste des serveurs STUN/TURN
 * @param {Function} options.onChange appelé à chaque changement à afficher
 * @param {Function} options.onError  appelé avec un message lisible en cas d'échec
 */
export function createVoice({ net, loadIce, onChange, onError }) {
  /** socketId → { pc, audio, name, color, speaking, analyser } */
  const peers = new Map();
  let localStream = null;
  let joined = false;
  let micOn = true;
  let jeParle = false;
  let audioContext = null;
  let boucleAnalyse = null;
  let iceServers = ICE_PAR_DEFAUT;

  // --- Écoute des messages du serveur ------------------------------------

  net.on("voice:joined", (peer) => {
    // Quelqu'un arrive APRÈS moi : c'est lui qui va m'appeler. Je me contente
    // de noter sa présence pour l'afficher.
    if (!joined) return;
    inscrire(peer);
    onChange?.(etat());
  });

  net.on("voice:left", ({ socketId }) => {
    fermerPeer(socketId);
    onChange?.(etat());
  });

  net.on("voice:speaking", ({ socketId, speaking }) => {
    const peer = peers.get(socketId);
    if (!peer) return;
    peer.speaking = speaking;
    onChange?.(etat());
  });

  net.on("voice:signal", async ({ from, kind, data }) => {
    if (!joined) return;
    const peer = peers.get(from) || inscrire({ socketId: from });
    try {
      if (kind === "offer") {
        await peer.pc.setRemoteDescription(data);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        net.emit("voice:signal", { to: from, kind: "answer", data: { type: answer.type, sdp: answer.sdp } });
      } else if (kind === "answer") {
        await peer.pc.setRemoteDescription(data);
      } else if (kind === "ice") {
        await peer.pc.addIceCandidate(data);
      }
    } catch (error) {
      // Une candidature ICE refusée est banale (chemin réseau abandonné) :
      // on ne dérange pas l'utilisateur pour ça.
      console.warn("[audio] message de signalisation ignoré :", error.message);
    }
  });

  // --- Rejoindre / quitter ------------------------------------------------

  async function join() {
    if (joined) return;
    if (!voiceSupported()) {
      onError?.("Ce navigateur ne sait pas faire d'appel audio.");
      return;
    }

    // 1) Demander le micro. C'est ici que le navigateur affiche sa fenêtre
    //    « Autoriser l'accès au microphone ? ».
    journal("demande d'accès au micro…");
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, // sinon chacun s'entend en écho
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (error) {
      journal(`MICRO REFUSÉ (${error.name}) : ${error.message}`);
      onError?.(messageMicro(error));
      return;
    }

    const pistes = localStream.getAudioTracks();
    journal(
      `micro obtenu : ${pistes.length} piste(s)` +
        pistes.map((p) => ` — « ${p.label || "sans nom"} », état ${p.readyState}`).join("")
    );
    if (!pistes.length) {
      onError?.("Le micro n'a fourni aucune piste audio.");
      return;
    }

    // 2) Demander au serveur par où passer (STUN, et TURN s'il en a un).
    //    En cas d'échec, on garde la liste de secours : mieux vaut un appel
    //    qui marche entre voisins que pas d'appel du tout.
    try {
      const reponse = await loadIce?.();
      if (Array.isArray(reponse?.iceServers) && reponse.iceServers.length) {
        iceServers = reponse.iceServers;
      }
      const adresses = iceServers.flatMap((serveur) => [].concat(serveur.urls));
      journal(
        `serveurs de mise en relation : ${adresses.filter((u) => u.startsWith("stun")).length} STUN, ` +
          `${adresses.filter((u) => u.startsWith("turn")).length} TURN` +
          (adresses.some((u) => u.startsWith("turn")) ? "" : " (aucun relais : 4G ↔ WiFi peut échouer)")
      );
    } catch (error) {
      journal(`serveurs de relais indisponibles, STUN par défaut : ${error.message}`);
    }

    joined = true;
    micOn = true;
    surveillerMonNiveauSonore();

    // 3) Prévenir le serveur, et récupérer la liste de ceux déjà présents.
    net.emit("voice:join", {}, async (reponse) => {
      if (!reponse?.ok) {
        onError?.("L'appel audio n'a pas pu démarrer.");
        leave();
        return;
      }
      journal(`entré dans l'appel — ${(reponse.peers || []).length} personne(s) déjà présente(s)`);
      // 4) J'appelle chacun d'eux (voir « Qui appelle qui ? » en haut).
      for (const peer of reponse.peers || []) {
        const entree = inscrire(peer);
        await appeler(peer.socketId, entree);
      }
      onChange?.(etat());
    });

    onChange?.(etat());
  }

  function leave() {
    if (!joined) return;
    journal("sortie de l'appel");
    joined = false;
    net.emit("voice:leave");
    for (const socketId of [...peers.keys()]) fermerPeer(socketId);
    localStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
    if (boucleAnalyse) cancelAnimationFrame(boucleAnalyse);
    boucleAnalyse = null;
    audioContext?.close().catch(() => {});
    audioContext = null;
    jeParle = false;
    onChange?.(etat());
  }

  /** Couper ou rallumer son micro, sans quitter l'appel. */
  function toggleMic() {
    if (!localStream) return;
    micOn = !micOn;
    // On n'arrête pas la piste : on la met en sourdine. La liaison reste
    // ouverte, donc rallumer le micro est instantané.
    for (const track of localStream.getAudioTracks()) track.enabled = micOn;
    if (!micOn && jeParle) {
      jeParle = false;
      net.emit("voice:speaking", false);
    }
    onChange?.(etat());
  }

  // --- Une liaison avec une autre personne --------------------------------

  function inscrire(peer) {
    const existant = peers.get(peer.socketId);
    if (existant) {
      if (peer.name) Object.assign(existant, { name: peer.name, color: peer.color });
      return existant;
    }

    const pc = new RTCPeerConnection({ iceServers });

    // On donne notre micro à cette liaison.
    if (localStream) for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

    // Chaque chemin réseau trouvé est envoyé à l'autre, au fil de l'eau.
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        net.emit("voice:signal", { to: peer.socketId, kind: "ice", data: event.candidate.toJSON() });
      }
    };

    // Le son de l'autre arrive : on le joue dans une balise <audio> cachée.
    pc.ontrack = (event) => {
      const entree = peers.get(peer.socketId);
      if (!entree) return;
      journal(`son reçu de ${entree.name}`);
      entree.audio.srcObject = event.streams[0];
      entree.audio.play().catch(() => {
        // Certains navigateurs refusent de jouer un son sans geste de
        // l'utilisateur. Ici il vient de cliquer « Rejoindre », donc ce cas
        // est rare ; on le signale sans casser l'appel.
        onError?.("Le son ne démarre pas — cliquez à nouveau sur la page.");
      });
      surveillerNiveauSonore(peer.socketId, event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      journal(`liaison avec ${peer.name || peer.socketId} : ${pc.connectionState}`);
      if (["failed", "closed"].includes(pc.connectionState)) {
        fermerPeer(peer.socketId);
        onChange?.(etat());
      }
    };

    // La balise <audio> est invisible : elle sert seulement à faire sortir le
    // son par les haut-parleurs.
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.hidden = true;
    document.body.appendChild(audio);

    const entree = {
      pc,
      audio,
      socketId: peer.socketId,
      name: peer.name || "Participant",
      color: peer.color || "#64748b",
      speaking: false,
    };
    peers.set(peer.socketId, entree);
    return entree;
  }

  async function appeler(socketId, entree) {
    try {
      const offer = await entree.pc.createOffer();
      await entree.pc.setLocalDescription(offer);
      net.emit("voice:signal", { to: socketId, kind: "offer", data: { type: offer.type, sdp: offer.sdp } });
    } catch (error) {
      console.warn("[audio] impossible d'appeler", socketId, error.message);
    }
  }

  function fermerPeer(socketId) {
    const entree = peers.get(socketId);
    if (!entree) return;
    entree.analyser?.disconnect();
    entree.source?.disconnect();
    try { entree.pc.close(); } catch { /* déjà fermée */ }
    entree.audio.srcObject = null;
    entree.audio.remove();
    peers.delete(socketId);
  }

  // --- « Qui parle ? » ----------------------------------------------------
  //
  // On mesure le volume du son en continu. Au-dessus d'un seuil, on considère
  // que la personne parle.
  //
  // DEUX PIÈGES qui rendaient l'indicateur muet, corrigés ici :
  //
  // 1. LA MESURE. On regardait la moyenne du SPECTRE DE FRÉQUENCES, sur toute
  //    la bande (0 à ~24 kHz). Or la voix n'occupe que le bas du spectre :
  //    les neuf dixièmes des mesures valaient zéro et écrasaient la moyenne.
  //    Un vrai micro restait donc sous le seuil même en parlant fort. On
  //    mesure maintenant le volume RÉEL du signal (« RMS », la moyenne de
  //    l'énergie), qui est la grandeur qu'on entend.
  //
  // 2. LE SEUIL FIXE. Un chiffre écrit en dur ne peut pas convenir à la fois
  //    à un micro de portable et à un casque. Le seuil s'ajuste maintenant
  //    tout seul au bruit ambiant : on suit le niveau le plus bas observé
  //    (le silence de la pièce) et on déclenche nettement au-dessus.
  //
  // Mon propre niveau est envoyé aux autres (ils ne peuvent pas le deviner
  // quand mon micro est coupé). Le niveau des autres se mesure directement
  // sur le son reçu : aucun message réseau supplémentaire.

  function contexteAudio() {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        journal("ce navigateur n'a pas d'AudioContext : pas d'indicateur de parole");
        return null;
      }
      audioContext = new Ctor();
      journal(`AudioContext créé, état « ${audioContext.state} »`);
    }

    // TRÈS IMPORTANT. Un AudioContext créé alors que le « geste utilisateur »
    // a expiré démarre SUSPENDU — et un analyseur suspendu ne mesure que du
    // silence, donc aucune pastille ne pulse jamais. C'est justement le cas
    // en ligne : le clic est consommé par la fenêtre « Autoriser le micro ? »,
    // et le contexte n'est créé qu'APRÈS la réponse. Sur iPhone, il démarre
    // suspendu dans tous les cas.
    if (audioContext.state === "suspended") {
      audioContext
        .resume()
        .then(() => journal(`AudioContext réveillé, état « ${audioContext.state} »`))
        .catch((error) => journal(`impossible de réveiller l'AudioContext : ${error.message}`));
    }
    return audioContext;
  }

  function brancherAnalyseur(stream) {
    const ctx = contexteAudio();
    if (!ctx) return null;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    // Lisse les variations trop brusques d'une image à l'autre.
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    return {
      source,
      analyser,
      donnees: new Uint8Array(analyser.fftSize),
      plancher: 1, // le silence de la pièce, appris au fil de l'eau
    };
  }

  /**
   * Volume réel du son, entre 0 et 1 (« RMS » = moyenne de l'énergie).
   *
   * On lit le signal tel qu'il est dans le temps, et non son spectre : c'est
   * exactement ce que perçoit l'oreille. 128 est le zéro (le silence), les
   * valeurs s'en écartent vers le haut et vers le bas.
   */
  function niveau(mesure) {
    const { analyser, donnees } = mesure;
    analyser.getByteTimeDomainData(donnees);
    let carre = 0;
    for (const valeur of donnees) {
      const ecart = (valeur - 128) / 128;
      carre += ecart * ecart;
    }
    return Math.sqrt(carre / donnees.length);
  }

  /**
   * Ce niveau correspond-il à quelqu'un qui parle ?
   *
   * Le seuil s'adapte : `plancher` descend vite vers le silence observé et
   * remonte très lentement, si bien qu'il représente le bruit de fond de la
   * pièce. On parle quand on est nettement au-dessus.
   */
  function ceciEstDeLaParole(mesure, valeur) {
    mesure.plancher =
      valeur < mesure.plancher
        ? valeur // le silence se reconnaît tout de suite
        : Math.min(mesure.plancher + 0.0004, valeur); // et se réapprend doucement
    const seuil = Math.max(mesure.plancher + MARGE_PAROLE, SEUIL_MINIMUM);
    return valeur > seuil;
  }

  function surveillerMonNiveauSonore() {
    const mesure = brancherAnalyseur(localStream);
    if (!mesure) return;
    journal("analyse de mon micro démarrée");
    let depuis = 0;
    let dernierRapport = 0;

    const boucle = () => {
      if (!joined) return;
      const valeur = niveau(mesure);
      const actif = micOn && ceciEstDeLaParole(mesure, valeur);
      if (actif) depuis = Date.now();
      const parleMaintenant = Date.now() - depuis < MAINTIEN_MS;

      // Affiche le niveau mesuré une fois par seconde, pour pouvoir
      // diagnostiquer un micro muet depuis la console (F12).
      if (debugActif() && Date.now() - dernierRapport > 1000) {
        dernierRapport = Date.now();
        journal(
          `niveau du micro ${valeur.toFixed(4)} | bruit de fond ${mesure.plancher.toFixed(4)}` +
            ` | seuil ${Math.max(mesure.plancher + MARGE_PAROLE, SEUIL_MINIMUM).toFixed(4)}` +
            ` | ${actif ? "PARLE" : "silence"}`
        );
      }

      if (parleMaintenant !== jeParle) {
        jeParle = parleMaintenant;
        net.emit("voice:speaking", jeParle);
        onChange?.(etat());
      }
      boucleAnalyse = requestAnimationFrame(boucle);
    };
    boucleAnalyse = requestAnimationFrame(boucle);
  }

  function surveillerNiveauSonore(socketId, stream) {
    const entree = peers.get(socketId);
    if (!entree || entree.analyser) return;
    const mesure = brancherAnalyseur(stream);
    if (!mesure) return;
    Object.assign(entree, mesure);

    let depuis = 0;
    const boucle = () => {
      const encore = peers.get(socketId);
      if (!encore || !joined) return;
      if (ceciEstDeLaParole(mesure, niveau(mesure))) depuis = Date.now();
      const parle = Date.now() - depuis < MAINTIEN_MS;
      if (parle !== encore.speaking) {
        encore.speaking = parle;
        onChange?.(etat());
      }
      requestAnimationFrame(boucle);
    };
    requestAnimationFrame(boucle);
  }

  // --- Ce que l'interface a besoin de savoir ------------------------------

  function etat() {
    return {
      joined,
      micOn,
      speaking: jeParle,
      peers: [...peers.values()].map((p) => ({
        socketId: p.socketId,
        name: p.name,
        color: p.color,
        speaking: p.speaking,
      })),
    };
  }

  function destroy() {
    leave();
  }

  return { join, leave, toggleMic, destroy, etat, get joined() { return joined; } };
}

/**
 * Traduit l'erreur du navigateur en une phrase compréhensible.
 * Les noms d'erreur sont normalisés (spécification « Media Capture »).
 */
export function messageMicro(error) {
  const nom = error?.name;
  if (nom === "NotAllowedError" || nom === "SecurityError") {
    return (
      "Micro refusé. Autorisez-le dans la barre d'adresse (icône 🔒 ou 🎙), " +
      "puis recliquez sur « Rejoindre l'audio ». Le tableau continue de " +
      "fonctionner normalement sans micro."
    );
  }
  if (nom === "NotFoundError" || nom === "OverconstrainedError") {
    return "Aucun microphone détecté sur cet ordinateur.";
  }
  if (nom === "NotReadableError") {
    return "Le micro est déjà utilisé par une autre application.";
  }
  return `Micro indisponible (${nom || "erreur inconnue"}).`;
}
