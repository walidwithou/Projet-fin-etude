# Révision complète du module rendez-vous

## PHASE 1 - AUDIT
- [x] Prisma db pull (schéma synchronisé)
- [x] Prisma generate (file lock Windows, schéma inchangé)
- [x] Audit complet du code

## PHASE 2 - RECONSTRUCTION DU WORKFLOW

### Backend
- [x] Ajouter `currentTherapist` (relation) dans `getProfile` patient
- [x] Ajouter `therapistAvailableTimeSlot` dans les includes des appointments
- [x] Corriger le bug timezone dans `createTimeSlots` (utiliser date+time string local)
- [x] Corriger le bug timezone dans `getAvailableSlots` (utiliser range de jour local)
- [x] Corriger `appointment.create` pour utiliser `slot.startAt` comme `scheduledAt`
- [x] Déprécier l'endpoint `updateAvailability` (JSON legacy) — retourne 410
- [x] Ajouter endpoint PUT pour modifier un créneau (Gérer)
- [x] Améliorer `getPatients` thérapeute pour inclure ceux qui ont eu des RDV
- [x] Améliorer l'historique thérapeute (status multi-valeurs via virgule)

### Frontend
- [x] Supprimer fallback "Mon thérapeute" - utiliser uniquement données API
- [x] Corriger timezone dans le calendrier thérapeute (utiliser date locale)
- [x] Corriger timezone dans la sélection de date patient
- [x] Garder `dateHasSlots` simple (futur uniquement)
- [x] Rendre le modal "Gérer" pleinement fonctionnel (CRUD complet)
- [x] Envoyer `slot.startAt` comme `scheduledAt` lors de la réservation
- [x] Améliorer le typage d'appointment côté frontend

## PHASE 3 - BOUTON GÉRER
- [x] Ajouter endpoint PUT `/therapists/availability/:slotId` backend
- [x] Modifier le modal dans Therapist.jsx pour supporter la modification (inline edit)
- [x] Tester le flux complet CRUD (Create, Read, Update, Delete)

## PHASE 4 - NOM DU THÉRAPEUTE
- [x] Backend : include `currentTherapist` dans `getProfile` patient (avec user.name)
- [x] Frontend : utilise directement le nom retourné par le backend (relation)
- [x] Supprimer tous les fallbacks "Mon thérapeute" (therapist devient null-safe)

## PHASE 5 - CALENDRIER
- [x] Vérifier que le calendrier affiche uniquement les données réelles
- [x] Supprimer toute donnée hardcodée (useState initial vide)
- [x] Corriger les bugs de timezone (formatYmdLocal)

## PHASE 6 - DISPONIBILITÉS
- [x] Conserver le modèle TherapistAvailableTimeSlot
- [x] Pas de status/available/unavailable
- [x] isBooked = false → libre
- [x] isBooked = true → réservé

## PHASE 7 - FRONTEND ↔ BACKEND
- [x] Vérifier que tous les composants utilisent des API réelles
- [x] Supprimer mocks et fake data
- [x] Documenter les endpoints utilisés

## PHASE 8 - TESTS (manuels à exécuter)
- [ ] Test 1: Création disponibilité → créneau visible
- [ ] Test 2: Modification disponibilité → calendrier mis à jour
- [ ] Test 3: Suppression disponibilité → créneau disparu
- [ ] Test 4: Réservation patient → Appointment créé
- [ ] Test 5: Confirmation thérapeute → statut = confirmed
- [ ] Test 6: Nom réel du thérapeute affiché
- [ ] Test 7: Bouton Gérer fonctionnel
- [ ] Test 8: Aucune donnée mockée
