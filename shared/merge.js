// ---------------------------------------------------------------------------
// RÈGLE DE FUSION DES MODIFICATIONS CONCURRENTES
// ---------------------------------------------------------------------------
// Ce fichier est le cœur du temps réel. Il est importé À LA FOIS par le
// serveur et par le navigateur, pour être certain que les deux appliquent
// exactement la même règle. C'est ce qui garantit que tout le monde finit
// avec le même dessin.
//
// Approche retenue : « dernière écriture gagne » (LWW = last-write-wins)
// par FORME, avec une horloge de Lamport.
//
// Une horloge de Lamport est un simple compteur :
//   - chaque participant garde un nombre `clock` ;
//   - quand il modifie une forme, il fait clock = max(clock connu) + 1 ;
//   - quand il reçoit une modification, il fait clock = max(clock, reçu).
// Résultat : si A modifie une forme APRÈS avoir vu la version de B, son
// numéro est forcément plus grand, donc sa version gagne. Ce n'est pas une
// horloge de montre : on ne compare jamais l'heure de deux machines, qui
// peuvent être déréglées.
//
// Si deux personnes modifient la même forme SANS s'être vues, les deux
// numéros peuvent être égaux : on départage alors par l'identifiant de
// l'auteur (comparaison de texte). Le choix est arbitraire, mais il est
// IDENTIQUE sur toutes les machines — c'est la seule chose qui compte.
// ---------------------------------------------------------------------------

/**
 * Compare deux opérations portant sur la même forme.
 * @returns {number} > 0 si `a` gagne, < 0 si `b` gagne, 0 si identiques.
 */
export function compareOps(a, b) {
  if (a.clock !== b.clock) return a.clock - b.clock;
  if (a.actor === b.actor) return 0;
  return a.actor > b.actor ? 1 : -1;
}

/**
 * Faut-il appliquer l'opération reçue par-dessus celle déjà connue ?
 * @param {{clock:number, actor:string}} incoming opération reçue
 * @param {{clock:number, actor:string}|undefined} existing opération connue
 */
export function shouldApply(incoming, existing) {
  if (!existing) return true;
  return compareOps(incoming, existing) > 0;
}

/**
 * Fait avancer une horloge de Lamport locale.
 * @param {number} local horloge locale actuelle
 * @param {number} [seen] horloge vue dans un message reçu
 */
export function tickClock(local, seen = 0) {
  return Math.max(local, seen) + 1;
}

/** Met à jour l'horloge locale à la réception d'un message (sans incrémenter). */
export function observeClock(local, seen) {
  return Math.max(local, seen);
}
