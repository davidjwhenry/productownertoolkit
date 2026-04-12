## User Story

As a **Mal Bank customer**, I want to **instantly freeze my debit card from the app**, so that **I can prevent unauthorized transactions if I suspect my card is lost or compromised**.

## Description

Users can freeze their AED debit card with a single tap from the Card Details screen. When frozen, all transaction attempts (POS, ATM, online) are declined until the card is unfrozen. The freeze action takes effect within 2 seconds.

## Acceptance Criteria

[ ] **AC1: Freeze card successfully**
  - Given the user is on the Card Details screen
  - And the card status is "Active"
  - When the user taps the **Freeze Card** button
  - Then the app displays a confirmation modal
  - And when the user confirms
  - Then the card status updates to "Frozen" within 2 seconds
  - And the user receives a push notification

[ ] **AC2: Freeze already-frozen card**
  - Given the card status is already "Frozen"
  - When the user views the Card Details screen
  - Then the **Freeze Card** button is disabled
  - And a message displays "Card is currently frozen"

[ ] **AC3: Error handling**
  - Given the user attempts to freeze the card
  - And the API call fails
  - When the error occurs
  - Then the app displays: "Unable to freeze card. Please try again."
  - And the card status remains unchanged

[ ] **AC4: Offline state**
  - Given the user is offline
  - When the user attempts to freeze the card
  - Then the app displays: "You need an internet connection to freeze your card"

## UI/UX Notes

**Figma Link**
[to be inserted]

## Technical Notes

**Third Party Requirements**
- List any required third parties

**Future Enhancement Considerations**
- Any scope expansion that needs to be considered today for technical work

## Edge Cases

1. Card already frozen by another session
2. Freeze during active transaction
3. Card expired or closed

## Tracking

| Event | Trigger |
|-------|---------|
| `profile_hub_opened` | User opens Profile Hub |
| `profile_picture_updated` | Picture upload succeeds |
| `logout_initiated` | User taps Logout |
| `logout_confirmed` | User confirms logout |

