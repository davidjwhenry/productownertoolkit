# Source Guide

Reference for each source type: what it reveals, what it misses, and recommended Firecrawl search strategies.

---

## [1] Community & Social

**Platforms:** Reddit, Hacker News, Product Hunt

**What it reveals:**
- Authentic, unfiltered user opinion — frustrations, workarounds, and advocacy
- Niche sub-communities discussing specific use cases or competitor comparisons
- Early adopter reactions and feature requests
- How users describe problems in their own language (valuable for JTBD framing)

**What it misses:**
- Enterprise or regulated-industry users (underrepresented on Reddit/HN)
- Users who never seek online community — often the silent majority
- Systematic or representative data

**Firecrawl search strategies:**
```
site:reddit.com "<product name>" review
site:reddit.com "<product name>" vs
site:reddit.com "<problem/pain point>" recommendation
site:reddit.com "<category> alternatives"
site:news.ycombinator.com "<product name>"
```

**Tips:**
- Prioritise threads with high comment counts — more signal
- Look for "Ask HN" threads for feature ideas and pain points
- Product Hunt comments surface early-adopter enthusiasm and initial friction
- Note subreddit names — they reveal the community the product serves

---

## [2] Review Sites

**Platforms:** G2, Capterra, Trustpilot, Gartner Peer Insights, GetApp, Software Advice

**What it reveals:**
- Structured user feedback on specific features, onboarding, support, and pricing
- Reviewer job title and company size (useful for segmenting feedback)
- Competitor comparisons (G2 "Alternatives" tabs)
- Scoring trends: ease of use, value for money, customer support

**What it misses:**
- Consumer products (most reviewers are business/SaaS users)
- Qualitative depth — reviews tend toward short, summarised opinions
- Negative reviews sometimes filtered or disincentivised by vendor review campaigns

**Firecrawl search strategies:**
```
site:g2.com "<product name>"
site:capterra.com "<product name>"
site:g2.com "<category>" best
"<product name>" reviews site:trustpilot.com
"<product name>" gartner peer insights
```

**Tips:**
- Scrape the "What do you like least?" / "What problems is the product solving?" sections — more revealing than summary ratings
- Check "Verified User" filter on G2 where available
- Note review volume — a product with 12 reviews is far less signal than one with 1,200

---

## [3] News & Analyst

**Platforms:** TechCrunch, VentureBeat, The Verge, Wired, industry-specific press, Forrester/Gartner blogs (where public), Benedict Evans, Stratechery, a16z

**What it reveals:**
- Funding rounds, acquisitions, and strategic moves
- Product launch coverage and initial market reception
- Analyst framing of the market category
- Macro trends in the space

**What it misses:**
- Ground-level user experience
- Negative product sentiment (press coverage skews toward launch news and milestones)
- Anything not large enough to generate press interest

**Firecrawl search strategies:**
```
"<product name>" site:techcrunch.com
"<product name>" site:venturebeat.com
"<category>" trends 2024 OR 2025
"<product name>" funding OR acquisition OR launch
"<category>" market analysis
```

**Tips:**
- Check publication date — news older than 18 months may reflect a different product state
- Look for commentary pieces (not just news) — more analytical framing
- Analyst blog posts (Stratechery, Benedict Evans) often frame market dynamics better than news coverage

---

## [4] Competitor Sites

**Target:** Competitor product pages, pricing pages, feature comparison pages, case studies, changelog/release notes, careers pages

**What it reveals:**
- How competitors position themselves and what they emphasise
- Pricing model and tier structure
- Claimed differentiators and target customer profile
- Release velocity (from changelog)
- Hiring priorities (from careers — signals where they are investing)

**What it misses:**
- Actual user experience vs. claimed experience
- Anything deliberately obscured (e.g. pricing behind a sales call)

**Firecrawl search strategies:**
```
firecrawl_scrape("<competitor homepage URL>")
firecrawl_scrape("<competitor pricing page URL>")
firecrawl_scrape("<competitor features page URL>")
"<competitor name>" changelog OR "what's new"
"<competitor name>" case study
```

**Tips:**
- Scrape the pricing page directly — pricing structure often reveals the business model and target segment
- "Customers" or "Case Study" pages reveal who they are actually selling to
- Careers pages show where the company is investing (e.g. heavy ML hiring signals a roadmap direction)
- Compare messaging across two or three competitors — gaps in their positioning are potential opportunities

---

## [5] Company Blogs

**Target:** Official product blogs, engineering blogs, design blogs, release notes

**What it reveals:**
- Product philosophy and design decisions explained by the team
- Technical architecture (engineering blogs)
- What the company considers worth announcing
- Roadmap signals (what they are talking about publicly)

**What it misses:**
- Objective assessment — this is first-party, self-serving content
- Anything the company considers competitive or wants to downplay

**Firecrawl search strategies:**
```
site:<company-blog-url> "<feature or topic>"
"<company name>" blog product update
"<company name>" engineering blog
"<product name>" release notes
```

**Tips:**
- Engineering blogs are often more candid than marketing blogs — look for technical decisions and trade-offs
- Design blogs can surface user research findings the company has made public
- Cross-reference blog claims with community/review feedback to spot gaps between messaging and experience

---

## [6] Academic & Research

**Target:** Published studies, survey reports, industry whitepapers (e.g. State of X reports), McKinsey/Deloitte/BCG public research

**What it reveals:**
- Market size, adoption rates, and growth projections
- Validated user behaviour patterns
- Regulatory and compliance context
- Benchmarks and comparative statistics

**What it misses:**
- Recency — academic research often lags the market by 2–3 years
- Specific product-level insights

**Firecrawl search strategies:**
```
"<category>" market size report 2024 OR 2025
"<topic>" survey findings
"<topic>" state of report
"<topic>" whitepaper site:mckinsey.com OR site:deloitte.com
"<topic>" study filetype:pdf
```

**Tips:**
- Prefer reports from 2023 or later unless historical context is needed
- Check methodology sections — sample size and methodology quality vary widely
- "State of [X]" annual reports (e.g. State of DevOps, State of Product Management) are often reliable benchmarks
- Note when a report is vendor-commissioned — treat with appropriate scepticism

---

## Choosing sources for a given research goal

| Goal | Priority sources |
|---|---|
| Pre-PRD user discovery | [1] Community, [2] Reviews |
| Competitive teardown | [4] Competitor sites, [2] Reviews, [1] Community |
| Market sizing & trends | [3] News & analyst, [6] Academic |
| Positioning & messaging analysis | [4] Competitor sites, [5] Company blogs |
| Feature gap analysis | [2] Reviews, [1] Community |
| Validation of a hypothesis | [1] Community, [2] Reviews, [3] News |
