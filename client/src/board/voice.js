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

// Au-dessus de ce niveau sonore (0 à 1), on considère que la personne parle.
const SEUIL_PAROLE = 0.045;
// On garde l'indicateur allumé un court instant après la fin du son, sinon il
// clignote entre chaque syllabe.
const MAINTIEN_MS = 400;

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
      onError?.(messageMicro(error));
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
    } catch (error) {
      console.warn("[audio] serveurs de relais indisponibles, STUN par défaut :", error.message);
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
  // On mesure le volume du son, en continu, avec un « analyseur » fourni par
  // le navigateur. Au-dessus d'un seuil, on considère que la personne parle.
  //
  // Mon propre niveau est envoyé aux autres (ils ne peuvent pas le deviner
  // quand mon micro est coupé). Le niveau des autres, lui, se mesure
  // directement sur le son reçu : aucun message réseau supplémentaire.

  function contexteAudio() {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    return audioContext;
  }

  function brancherAnalyseur(stream) {
    const ctx = contexteAudio();
    if (!ctx) return null;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    return { source, analyser, donnees: new Uint8Array(analyser.frequencyBinCount) };
  }

  /** Volume moyen, ramené entre 0 et 1. */
  function niveau({ analyser, donnees }) {
    analyser.getByteFrequencyData(donnees);
    let total = 0;
    for (const valeur of donnees) total += valeur;
    return total / donnees.length / 255;
  }

  function surveillerMonNiveauSonore() {
    const mesure = brancherAnalyseur(localStream);
    if (!mesure) return;
    let depuis = 0;

    const boucle = () => {
      if (!joined) return;
      const actif = micOn && niveau(mesure) > SEUIL_PAROLE;
      if (actif) depuis = Date.now();
      const parleMaintenant = Date.now() - depuis < MAINTIEN_MS;

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
      if (niveau(mesure) > SEUIL_PAROLE) depuis = Date.now();
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
