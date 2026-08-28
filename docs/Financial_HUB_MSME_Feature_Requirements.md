# Financial HUB --- MSME Segment Feature Requirements

> **Document status:** Working product requirements draft\
> **Scope:** MSME/business segment only\
> **Purpose:** Consolidates all MSME features discussed in the shared
> conversations and handwritten planning notes.

------------------------------------------------------------------------

## 1. Product Overview

Financial HUB's MSME segment should help small and medium businesses
organise income, expenses, planned business objectives, and
project/event finances.

The segment goes beyond traditional expense tracking and helps answer:

> **Where should incoming money go next?**

The product has two main areas:

1.  **General MSME financial management** --- ongoing business income,
    expenses, savings, operations, and growth.
2.  **Event/project-based financial planning** --- one project/event
    allocation flow at a time, using priority-based target funding and
    automatic fund cascading.

------------------------------------------------------------------------

# 2. General MSME Financial Management

## 2.1 Income and Revenue

The system should record and manage:

-   Sales income
-   Revenue
-   Client payments
-   Deposits and down payments
-   Other business income

## 2.2 Business Pockets

Users can create financial pockets to organise business money.

### Pocket limit

-   Maximum **6 custom main pockets**
-   Each main pocket can have multiple sub-pockets
-   The interface should avoid information overload, especially where
    many sub-pockets exist

## 2.3 Sub-Pockets

Sub-pockets break a main pocket into specific purposes.

Example:

``` text
Recurring Expenses
├── Rent
├── Electricity
├── Wi-Fi
├── Security
├── Utilities
└── Salaries and Wages
```

Sub-pockets may track:

-   Funding target or cap where applicable
-   Allocated amount
-   Spending
-   Remaining cash

------------------------------------------------------------------------

# 3. Recurring and Fixed Expenses

Support recurring/fixed business expenses such as:

-   Rent
-   Electricity
-   Wi-Fi/Internet
-   Security
-   Utilities
-   Salaries and wages
-   Licences
-   Taxes
-   Other regular operational expenses

------------------------------------------------------------------------

# 4. Savings

The MSME segment should support a dedicated savings allocation.

The planning notes mention **10% savings** as an example.

Savings may receive:

-   Planned savings allocations
-   Surplus funds
-   Excess funds from completed event/project funding, after prompting
    the user

The system should prompt the user before moving applicable excess funds
to Savings.

------------------------------------------------------------------------

# 5. Restocking, Capital Preservation and Cash Flow

Support planning and allocation for:

-   Restocking goods
-   Capital preservation
-   Working capital
-   Supplier payments
-   Operational cash flow

------------------------------------------------------------------------

# 6. Supplier Payments

The system should support allocation and planning for:

-   Supplier payments
-   Purchase of stock
-   Cash required for business operations

These can be represented as main pockets or sub-pockets.

------------------------------------------------------------------------

# 7. Licences and Taxes

The business should be able to allocate and track money for:

-   Business licences
-   Taxes
-   Other statutory or regulatory payments

------------------------------------------------------------------------

# 8. Profit and Owner/Personal Allocation

The system should support separation between business and owner
finances.

Possible categories include:

-   Business profit
-   Personal pay
-   Personal activities

------------------------------------------------------------------------

# 9. Business Growth and Expansion

Support planned allocation toward:

-   Marketing
-   Expansion into an untapped market
-   Purchasing new equipment
-   New ventures
-   Existing business orders
-   Business expansion

------------------------------------------------------------------------

# 10. Loan Planning

The MSME segment should support a **Loan Plan**.

When borrowed money is received or planned, the user defines its
intended purpose.

Example:

``` text
Loan Plan
├── Marketing
├── New Equipment
├── Business Expansion
├── New Venture
└── Existing Business Order
```

## 10.1 Loan Repayment Pocket

Include a dedicated **Loan Repayment Pocket** for reserving or
allocating money toward future repayments.

------------------------------------------------------------------------

# 11. Event and Project-Based Financial Planning

Support businesses that operate around specific:

-   Catering events
-   Weddings
-   Road trips
-   Tours
-   Client contracts
-   Construction projects
-   Seasonal agribusiness activities
-   Other one-time business ventures

A financial plan should be created before all project income has been
received.

## 11.1 One Project/Event Allocation Flow

The automatic Funding Cascade should operate on **one project or event
at a time**.

A single incoming payment should not be automatically split across
multiple projects.

------------------------------------------------------------------------

# 12. Priority-Based Planning

Every event/project uses exactly three funding levels:

1.  **Priorities** --- critical items funded first
2.  **Needs** --- important items funded after priorities
3.  **Wants** --- optional or additional items funded last

No additional priority levels should be added.

Example:

``` text
Event / Project
│
├── Priorities
│   ├── Essential materials
│   ├── Critical labour
│   └── Transport
│
├── Needs
│   ├── Additional equipment
│   └── Supporting activities
│
└── Wants
    ├── Premium upgrades
    └── Optional extras
```

------------------------------------------------------------------------

# 13. Target-Based Funding

Event/project categories should use **target-based funding**, not
balance-based replenishment.

Each category has a predefined funding target.

Once that target is reached, its funding status becomes:

> **Funded / Complete**

Spending from the category must not automatically make it unfunded
again.

------------------------------------------------------------------------

# 14. Separation of Funding and Spending

The system must distinguish between:

## Funding Progress

Tracks whether the planned target has been allocated.

``` text
Target: KES 250,000
Allocated: KES 250,000
Funding Status: Complete
```

## Spending Progress

Tracks how much allocated money has been used.

``` text
Allocated: KES 250,000
Spent: KES 180,000
```

## Remaining Cash

Tracks money still available.

``` text
Remaining Cash: KES 70,000
```

### Core Rule

A decrease in remaining cash must **not** automatically reopen a
completed funding target.

------------------------------------------------------------------------

# 15. Funding Cascade Model

Incoming money is allocated according to priority and funding
completion:

``` text
Incoming Money
      ↓
Priorities
      ↓
Needs
      ↓
Wants
```

The system should:

1.  Find the highest-priority category that has not reached its target.
2.  Allocate incoming money to that category.
3.  Stop once the target is complete.
4.  Automatically cascade any remaining money to the next unfunded
    category.
5.  Continue until the payment is fully allocated or all targets are
    funded.

## 15.1 No Re-Funding of Completed Categories

Once a category reaches its funding target, future income must not
refill it simply because money was spent.

Example:

``` text
Target: KES 250,000
Allocated: KES 250,000
Status: Complete
```

After spending KES 180,000:

``` text
Remaining Cash: KES 70,000
Funding Status: Complete
```

The next client payment goes to **Needs**, not back to Priorities.

------------------------------------------------------------------------

# 16. Down Payments and Instalments

Support staged client payments such as:

``` text
Payment 1 → Deposit / Down Payment
Payment 2 → Progress Payment
Payment 3 → Final Payment
```

The user records:

> **Received KES X**

The system automatically allocates the payment based on:

-   Priority order
-   Funding targets
-   Categories already completed
-   Remaining unfunded categories

The user cannot manually change or override the automatic funding
sequence.

------------------------------------------------------------------------

# 17. Example Funding Flow

## Project: Catering Event

**Contract Value: KES 500,000**

  Category       Funding Target
  ------------ ----------------
  Priorities        KES 250,000
  Needs             KES 150,000
  Wants             KES 100,000

### Payment 1 --- KES 250,000

``` text
Priorities → KES 250,000 → Complete
Needs      → KES 0
Wants      → KES 0
```

### Spending

The business spends KES 180,000:

``` text
Funding Status: Complete
Spent: KES 180,000
Remaining Cash: KES 70,000
```

### Payment 2 --- KES 100,000

``` text
Priorities → Already Complete
Needs      → Receives KES 100,000
Wants      → KES 0
```

Priorities must not be refilled.

### Final Payment

The system:

1.  Completes Needs.
2.  Cascades any remaining funds to Wants.

------------------------------------------------------------------------

# 18. Funding and Spending Dashboard

Each project/event should clearly show:

### Funding Status

-   Target amount
-   Amount allocated
-   Funding percentage
-   Complete/In Progress status

### Spending Status

-   Amount spent
-   Remaining cash

Example:

``` text
PRIORITIES

Funding
Target:       KES 250,000
Allocated:    KES 250,000
Progress:     100%
Status:       Complete

Spending
Spent:        KES 180,000
Cash Left:    KES 70,000
```

------------------------------------------------------------------------

# 19. Visual Funding Progress

The project/event dashboard should show visual progress for:

-   Priorities
-   Needs
-   Wants

Example:

``` text
PROJECT FUNDING

Priorities
████████████████████  100%

Needs
██████████████░░░░░░   70%

Wants
███░░░░░░░░░░░░░░░░░   15%
```

Users should quickly identify:

-   Fully funded categories
-   Partially funded categories
-   Unfunded categories
-   Amount spent
-   Remaining cash
-   Where the next incoming payment will go

------------------------------------------------------------------------

# 20. Smart Spending Controls

Spending controls should be **optional**.

Possible controls include:

-   Warning users when lower-priority funds are being used before
    critical priorities are funded
-   Keeping Wants unavailable until Priorities and Needs are funded
-   Showing recommendations about potentially risky spending

These controls encourage discipline but should not be mandatory.

------------------------------------------------------------------------

# 21. Excess Funds

If incoming money exceeds the amount required for the planned funding
targets, the system should prompt the user rather than silently deciding
where the excess goes.

The user can be prompted to direct excess funds to:

-   Needs
-   Wants

Where Savings is appropriate:

1.  Prompt the user.
2.  Inform the user of the proposed allocation.
3.  Move the funds to Savings after confirmation.

------------------------------------------------------------------------

# 22. Completed or Closed Project/Event

When a project/event is completed, unused money can:

-   Remain in the relevant pocket, or
-   Be moved to Savings

The system should notify the user when action may be necessary,
especially when:

-   A project is completed
-   Funds remain unused
-   Funds have remained inactive
-   A project has been cancelled or closed

The system must not silently transfer or remove remaining funds.

------------------------------------------------------------------------

# 23. Funding Model Rules

The event/project model must follow these rules:

-   Funding is based on predefined targets.
-   Spending does not reduce funding completion status.
-   Completed categories are not automatically refilled.
-   Incoming money cascades forward to the next unfunded category.
-   The priority sequence cannot be manually changed.
-   Automatic allocation cannot be manually overridden.
-   Only one event/project uses the automatic funding cascade at a time.
-   There are exactly three levels: Priorities, Needs, and Wants.
-   Spending restrictions are optional.
-   Excess funds require user direction through prompts.
-   Savings allocation from surplus requires a prompt first.

------------------------------------------------------------------------

# 24. General MSME Pockets vs Event/Project Funding

The exact relationship between general MSME pockets and event/project
funding is **not yet finalised**.

For now, they should be treated as separate functional areas.

## General MSME Management

Used for:

-   Recurring expenses
-   Savings
-   Restocking
-   Suppliers
-   Licences and taxes
-   Profit
-   Owner allocations
-   Growth
-   Loans

## Event/Project Management

Used for:

-   Priorities
-   Needs
-   Wants
-   Funding targets
-   Incoming project payments
-   Automatic funding cascade
-   Spending tracking
-   Remaining cash

### Current requirement

The event/project Funding Cascade should **not automatically interact
with or distribute funds across general MSME pockets**.

------------------------------------------------------------------------

# 25. Suggested Core Feature Name

## Funding Cascade Model

Alternative names:

-   **Priority Allocation Engine (PAE)**
-   **Smart Funding Cascade**

Core principle:

> **Income moves forward through predefined financial objectives based
> on funding completion, rather than moving backward to refill
> categories whose allocated money has already been spent.**

------------------------------------------------------------------------

# 26. Consolidated Feature List

## Core Financial Management

-   Income and revenue tracking
-   Sales and client payment recording
-   Deposit/down payment recording
-   Maximum 6 custom main pockets
-   Multiple sub-pockets
-   Information-overload-aware pocket presentation
-   Recurring and fixed expenses
-   Savings
-   Restocking and capital preservation
-   Supplier payments
-   Cash-flow planning
-   Licences and taxes
-   Profit allocation
-   Personal/owner pay allocation
-   Personal activities allocation

## Business Growth

-   Marketing allocation
-   Untapped market expansion
-   New equipment planning
-   New venture planning
-   Existing business order funding
-   Business expansion planning

## Loans

-   Loan planning
-   Loan purpose allocation
-   Loan repayment pocket

## Event and Project Planning

-   Create an event/project financial plan
-   One automatic project/event funding flow at a time
-   Three fixed priority levels
-   Priorities
-   Needs
-   Wants
-   Predefined funding targets
-   Down payment support
-   Instalment payment support
-   Automatic incoming payment allocation
-   Target-based funding
-   Funding completion tracking
-   Spending tracking
-   Remaining cash tracking
-   Automatic forward funding cascade
-   No automatic re-funding of completed categories
-   Optional spending controls
-   Excess-fund prompts
-   Savings prompts
-   Completed-project remaining fund handling
-   Notifications for unused/inactive funds
-   Visual funding progress

------------------------------------------------------------------------

# 27. Core Product Differentiator

The strongest MSME-specific concept is the combination of:

-   Priority-based financial planning
-   Target-based funding
-   Automatic allocation of incoming money
-   Separation of funding from spending
-   Forward cascading of income
-   Down payment and instalment support

In simple terms:

> **Financial HUB should not only show where a business has spent money.
> It should help direct incoming money toward the next planned business
> objective according to predefined priorities and funding targets.**

------------------------------------------------------------------------

# 28. Remaining Design Decisions

The following require further product and technical design:

1.  The exact UX for many sub-pockets without information overload.
2.  The exact prompt flow for excess funds.
3.  The rules for suggesting Needs, Wants, or Savings when excess funds
    exist.
4.  Notification timing for inactive or unused project funds.
5.  The lifecycle and closure process for completed or cancelled
    projects.
6.  The final architecture boundary between general MSME pockets and
    event/project funding.
7.  The data model for separating allocated funds, spending, and actual
    remaining cash.
