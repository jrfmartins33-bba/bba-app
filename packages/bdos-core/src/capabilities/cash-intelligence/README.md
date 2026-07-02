# Cash Intelligence

Cash Intelligence is a BDOS Business Capability focused on cash-related business knowledge.

A Capability is responsible for supplying business knowledge to the Decision Engine. It does not own the Decision Engine, persistence, user interfaces, APIs, or infrastructure concerns.

## Architecture

Cash Intelligence is organized into three knowledge layers.

## Facts

Facts represent observable business information.

Documentation examples:

- Current Cash Balance
- Upcoming Receivables
- Upcoming Payables
- Average Daily Cash Burn
- Credit Line Available
- Minimum Cash Reserve

## Patterns

Patterns represent business situations detected from Facts.

Documentation examples:

- Negative Cash Projection
- High Customer Concentration
- Low Liquidity
- High Financial Risk
- Receivable Concentration

## Rules

Rules transform Patterns into Decisions.

Documentation examples:

- If projected cash becomes negative, generate Cash Deficit Decision.
- If customer concentration exceeds threshold, generate Concentration Risk Decision.

## Boundaries

Cash Intelligence only provides business knowledge. It does not know React, Supabase, databases, APIs, Advisor, UI, or Decision Engine internals.
