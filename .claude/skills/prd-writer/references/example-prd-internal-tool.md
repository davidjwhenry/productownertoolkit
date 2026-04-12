# Support Operations Triage Console

Author: Product Ops
Document Version: 0.3
Document Status: Reviewing
Document Type: PRD

## 1. TL;DR

- This PRD defines an `MVP` internal console that helps support agents get a case to the right owner quickly, with enough context to make a confident routing decision.
- The product is for Tier 1 support agents first, with lightweight visibility for team leads.
- MVP scope includes a unified intake queue, a case review workspace, recommended routing, manual override notes, and immutable audit history.
- The main outcome is faster first-pass routing with fewer bounces between downstream teams.
- The primary success metric is median time from case arrival to first correct routing decision.
- The MVP depends on reliable case ingestion from the existing support platform, customer context services, and role-based access controls.

## 2. Product Shape

| Item | Decision |
| --- | --- |
| `PRD Phase` | `MVP` |
| `Lineage` | New PRD |
| `Product Posture` | Extension of the existing internal support platform rather than a new standalone product |
| `Adjacent Surfaces` | Support platform case record, customer profile service, team queue dashboards |
| `Entry Point Hypothesis` | Agents start from a unified queue; team leads deep-link in from queue or reporting views |

## 3. Strategic Context

### 3.1. Job To Be Done

| JTBD Lens | Notes |
| --- | --- |
| **Main job** | Get an incoming customer case to the right owner quickly, with enough confidence that it will not bounce back. |
| **Current approach** | Agents gather context across several tools, apply tribal routing knowledge, and hand off manually. |
| **Current friction** | Tool switching, inconsistent routing rules, and weak audit history slow triage and create rework. |
| **Desired progress** | Agents should reach a correct first routing decision faster, with a clear record of why it happened. |

**Who experiences this:** Tier 1 support agents, operations analysts, complaints specialists, and support team leads.

### 3.2. Why This Stage Now

- The current support workflow already has a source system for cases, but no focused triage layer.
- Routing inconsistency is creating avoidable delays and reassignments.
- An `MVP` is enough to prove that consolidating context and codifying routing logic improves first-pass decision quality.

## 4. Goals & Rabbit Holes

### 4.1. What We Want To Achieve

| Goal | Why it matters now |
| --- | --- |
| **See enough context quickly** | Agents should not need several tabs open before deciding where a case belongs. |
| **Route with confidence on the first pass** | Fewer bounces means faster customer handling and less specialist-team rework. |
| **Create a clear audit trail** | Team leads need to understand what changed, who changed it, and why. |

### 4.2. Rabbit Holes We Will Avoid

| Rabbit Hole | Why it is out of scope now |
| --- | --- |
| **Full case resolution workflow** | The job here is triage and handoff, not end-to-end case handling. |
| **Automated customer responses** | Auto-replies are a separate tooling stream with different quality and compliance risks. |
| **Workforce planning and staffing views** | Capacity management is adjacent, but not needed to prove the triage console works. |
| **Advanced reassignment workflows for every manager persona** | The MVP should optimize the common agent flow before expanding oversight tooling. |

## 5. Functional Requirements

### 5.1. Unified Intake Queue

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| UQ.1 | Display new inbound cases in a single queue with current status, source, urgency, and created time. | P0 | This is the default landing view after sign-in. |
| UQ.2 | Allow agents to filter the queue by source, priority, category, and assigned team. | P0 | Filters should persist during the user session. |
| UQ.3 | Support search by case ID, customer ID, and customer name. | P1 | Name search must respect masking rules. |

### 5.2. Case Review Workspace

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| CR.1 | Display a case review view with issue summary, customer profile, recent account activity, and prior contacts. | P0 | The workspace should consolidate context, not create a new source of truth. |
| CR.2 | Show a recommended destination queue based on codified routing rules and case metadata. | P0 | Recommendations are advisory in the MVP. |
| CR.3 | Display visible warnings for complaints, vulnerable customer markers, and fraud-related indicators. | P0 | These markers affect priority and routing path. |

### 5.3. Routing And Audit

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| RA.1 | Allow the agent to route a case to a target queue and include a routing note when overriding the recommendation. | P0 | Override notes are mandatory for trust and auditability. |
| RA.2 | Prevent stale or conflicting routing submissions when another user has already taken action on the case. | P0 | The user should be prompted to refresh and review the latest state. |
| RA.3 | Log every routing action, note, and queue status change with timestamp and user ID. | P0 | Audit history must be immutable. |
| RA.4 | Display the case's full triage history inside the review workspace. | P0 | Users should not need a separate audit tool for normal review. |
| RA.5 | Allow privileged users to reassign a case after initial routing. | P1 | This is useful, but not required to prove the agent workflow. |

## 6. Entry Points, Core Journey & Platform Fit

### 6.1. Entry Points & Context

| Entry Point | Why it makes sense |
| --- | --- |
| **Operations Console** from the internal tool launcher | Gives agents a dedicated place to start the triage job. |
| **Open in Triage Console** from the support platform | Supports deep-linking when a user is already inside an existing support workflow. |

### 6.2. Core Journey

| Step | User move | Product response |
| --- | --- | --- |
| 1 | Agent opens the queue and selects an unassigned case. | The console opens the case workspace with case context and customer context loaded. |
| 2 | Agent reviews the issue summary, recent activity, warnings, and recommended queue. | The console shows the relevant signals needed for a routing decision. |
| 3 | Agent accepts the recommendation or chooses a different queue. | The console requires an override note when the recommendation is not used. |
| 4 | Agent submits the routing decision. | The console records the audit event, updates ownership, and removes the case from the unassigned queue. |

### 6.3. Platform Fit & Adjacent Surfaces

| Consideration | Notes |
| --- | --- |
| **Logical home** | The console should sit as a triage-focused layer on top of the existing support platform. |
| **Adjacent surfaces** | The experience should stay consistent with case records, customer profile views, and downstream team queues. |
| **Foundation vs extension** | This is an extension of an existing operations stack, not a new case-management platform. |

## 7. Success Metrics & Gates

| Metric | Definition | Target | Measurement | Why it matters |
| --- | --- | --- | --- | --- |
| **Median time to first routing decision** | Median elapsed time between a case entering the queue and the first routing action | -35% vs. baseline | Support ops reporting | Proves the triage job is getting easier to complete. |
| **First-pass routing accuracy** | Percentage of cases not reassigned within 24 hours of first routing | >85% | Queue history analysis | Proves speed is not coming at the cost of quality. |
| **Audit coverage** | Percentage of routing actions with timestamp, actor, destination, and note history captured | 100% | Audit log validation | Proves the workflow is reviewable and controllable. |
| **Workspace load time** | p95 time to load the case workspace with core context | <2.5 seconds | Frontend monitoring | Slow loading would undermine the central promise of faster triage. |

## 8. Systems, Risks & Compliance

| Area | What matters | Why it matters now |
| --- | --- | --- |
| **Support platform** | Must provide reliable case ingestion, case metadata, and a write path for routing outcomes. | The console cannot exist without a stable source system. |
| **Customer profile service** | Must provide enough customer and account context for triage decisions. | Missing context reduces first-pass confidence. |
| **Routing rules source** | Routing logic needs one maintained rule source instead of tribal knowledge and scattered docs. | Recommendation quality will drift without clear ownership. |
| **Authentication and RBAC** | Sensitive case markers and reassignment controls must respect role-based permissions. | The tool will surface operationally sensitive information. |
| **Audit and retention controls** | Routing actions and notes must be durable, reviewable, and aligned to existing retention rules. | The console should improve governance, not weaken it. |
| **Data protection** | The workspace should expose only the fields needed for triage. | The MVP should not duplicate or persist unnecessary PII. |
| **Accessibility** | Keyboard navigation, readable contrast, and visible focus states are required. | Internal tools still need to be fast and usable for all operators. |
