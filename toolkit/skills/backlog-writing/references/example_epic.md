## Overview

Enable users to instantly freeze and unfreeze their AED debit card from within the app for security and control. When frozen, all card transactions are blocked until the user unfreezes it.

## Business Value

Reduces fraud exposure by giving users immediate control over their card. Decreases support tickets for lost/stolen cards where the card is later found. Increases user trust and app engagement.

**Target Metrics:**
- >30% of users aware of freeze feature within 3 months
- <2% card replacement rate for temporarily misplaced cards
- Positive NPS impact

## Functional Scope

This epic addresses:
- **F2.1:** Freeze card functionality with instant blocking
- **F2.2:** Unfreeze card with immediate restoration of services

## User Stories

| ID | Story | Priority | Status |
|---|---|---|---|
| US-5.1 | Freeze debit card | P0 | Draft |
| US-5.2 | Unfreeze debit card | P0 | Draft |
| US-5.3 | View freeze status | P0 | Draft |

## Dependencies

- Paymentology API integration for card control
- Real-time status sync between app and card processor
- Notification service for freeze/unfreeze confirmations

## Technical Considerations

**APIs:**
- `POST /api/v1/cards/{cardId}/freeze`
- `POST /api/v1/cards/{cardId}/unfreeze`
- `GET /api/v1/cards/{cardId}/status`

**Edge Cases:**
- Handle freeze requests when card is already frozen
- Handle unfreeze requests when card is already active
- Offline state management (show last known status)

**Figma Link**
[to be inserted]
