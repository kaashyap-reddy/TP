# Trainee Management Portal — User Flows

**Version:** 1.0  
**Prepared from:** the implemented React routes, role navigation, page actions, backend rules, and the verified project audit  
**Roles:** Admin, Facilitator, Trainee

## 1. Flow legend

```mermaid
flowchart LR
    A([Start or end]) --> B[User action or system step]
    B --> C{Decision or validation}
    C -->|Yes| D[Continue]
    C -->|No| E[Error, retry, or alternate path]
```

## 2. Portal entry, authentication, and account activation

```mermaid
flowchart TD
    A([Open portal]) --> B{How is the user entering?}

    B -->|Existing account| C[Enter company email and password]
    C --> D{Credentials valid?}
    D -->|No| E[Show sign-in error]
    E --> C
    D -->|Yes| F{User role}

    B -->|Forgot password| G[Enter account email and new password]
    G --> H{Passwords valid and matching?}
    H -->|No| I[Show validation error]
    I --> G
    H -->|Yes| J[Reset password]
    J --> C

    B -->|Trainee invite| K{Invite token present?}
    K -->|No| L[Show invalid invite message]
    L --> A
    K -->|Yes| M[Confirm invited email and create password]
    M --> N{Passwords match?}
    N -->|No| O[Show validation error]
    O --> M
    N -->|Yes| P[Activate account and sign in]
    P --> F

    B -->|Demo preview| Q[Choose Admin, Facilitator, or Trainee]
    Q --> F

    F -->|Admin| R([Admin portal])
    F -->|Facilitator| S([Facilitator portal])
    F -->|Trainee| T([Trainee portal])
```

## 3. Admin — create and onboard a batch

This is the main business flow. A training-plan template is copied into the new batch; later batch edits do not change the original template.

```mermaid
flowchart TD
    A([Admin portal]) --> B[Open Batch Management]
    B --> C[Select Create Batch]
    C --> D[Enter batch name]
    D --> E[Choose BA BTech or BA MBA training plan]
    E --> F[Choose start date]
    F --> G[Optionally assign trainer]
    G --> H{Add roster now?}
    H -->|Yes| I[Upload trainee CSV]
    I --> J[Review detected trainee count]
    H -->|No| K[Continue without roster]
    J --> L[Confirm Create Batch]
    K --> L

    L --> M[Create batch record]
    M --> N[Copy selected training plan into batch]
    N --> O[Generate working-day session schedule]
    O --> P[Generate related assignments and deadlines]
    P --> Q[Copy resources, announcements, and feedback links]
    Q --> R{Roster supplied?}
    R -->|Yes| S[Create trainee invitations]
    R -->|No| T[Batch remains ready for later enrollment]
    S --> U[Show success message]
    T --> U
    U --> V([Open batch details and manage roster])
```

### Admin — invite an individual trainee

```mermaid
flowchart LR
    A([Batch Management]) --> B[Select Invite Trainee]
    B --> C[Enter trainee and batch details]
    C --> D[Send invitation]
    D --> E[Trainee opens invite link]
    E --> F[Creates password]
    F --> G([Account activated and trainee signed in])
```

## 4. Admin — manage training plans and portal operations

```mermaid
flowchart TD
    A([Admin portal]) --> B{Choose work area}

    B -->|Training Plans| C[Open BA BTech or BA MBA template]
    C --> D{Required change}
    D -->|Session| E[Add, view, edit, reschedule, or delete session]
    D -->|Assignment| F[Add, view, edit, reschedule, or delete assignment]
    D -->|Deploy plan| G[Assign plan to a new batch]
    E --> H[Save template change]
    F --> H
    H --> I[Existing batch copies remain unchanged]
    G --> J[Continue through Create Batch flow]

    B -->|Sessions and Calendar| K[View list or calendar]
    K --> L[Manage schedule, attendance, and session feedback link]
    L --> M{Feedback audience}
    M -->|Trainees| N[Visible to eligible trainees]
    M -->|Facilitators| O[Visible to owning facilitator]
    M -->|Both| P[Visible to both groups]

    B -->|Resources| Q[Upload master resource]
    Q --> R[Resource is pending verification]
    R --> S{Verify?}
    S -->|Yes| T[Make resource visible to eligible trainees]
    S -->|No or delete| U[Keep hidden or remove]

    B -->|Announcements| V[Compose message, priority, audience, and schedule]
    V --> W[Post or schedule announcement]

    B -->|Reports| X[Choose report and optional date range]
    X --> Y{Output}
    Y -->|CSV| Z[Export CSV]
    Y -->|PDF| AA[Export PDF]
    Y -->|Recurring| AB[Add report schedule]

    B -->|Audit Logs| AC[Search and review recorded system activity]
```

## 5. Facilitator — deliver training and monitor trainees

Facilitators can work only with their assigned batches and trainees.

```mermaid
flowchart TD
    A([Facilitator portal]) --> B[Review dashboard alerts and metrics]
    B --> C{Choose task}

    C -->|Manage batch| D[Open Batches]
    D --> E[Open assigned batch details]
    E --> F[Review roster and per-trainee progress]
    F --> G[Open trainee profile]
    G --> H[Review attendance, assignments, and performance]
    H --> I([Return to the same batch])

    C -->|Run a session| J[Open Sessions and Calendar]
    J --> K[Select list or calendar view]
    K --> L[Open or schedule session]
    L --> M{Session completed?}
    M -->|No| N[Edit schedule or details]
    M -->|Yes| O[Record attendance]
    O --> P{Facilitator feedback form available?}
    P -->|Yes| Q[Open form and submit session feedback]
    P -->|No| R[Continue without form]
    Q --> S([Session delivery complete])
    R --> S

    C -->|Manage assignments| T[Open Assignments]
    T --> U[Create, duplicate, close, or delete assignment]
    U --> V[Open submissions]
    V --> W{Submission received?}
    W -->|No| X[Send reminder or monitor]
    W -->|Yes| Y[Open or download submission]
    Y --> Z[Enter score, status, and optional feedback]
    Z --> AA[Save grade]
    AA --> AB([Trainee result updated])

    C -->|Communicate| AC[Post announcement or upload resource]
    AC --> AD[Choose relevant batch or audience]
    AD --> AE([Content available to eligible users])

    C -->|Feedback and Reports| AF[Review feedback and performance indicators]
```

## 6. Trainee — complete an assignment

Late first submissions are allowed. Replacing an existing submission is allowed only before the deadline.

```mermaid
flowchart TD
    A([Trainee portal]) --> B[Open Assignments]
    B --> C[Search or filter assignments]
    C --> D[Open assignment details or file]
    D --> E{Existing submission?}

    E -->|No| F[Select Submit Work]
    F --> G[Choose file and optionally add comment]
    G --> H{File selected?}
    H -->|No| I[Show file-required error]
    I --> G
    H -->|Yes| J[Upload submission]
    J --> K{Deadline already passed?}
    K -->|Yes| L[Record as late first submission]
    K -->|No| M[Record normal submission]
    L --> N([Submission saved])
    M --> N

    E -->|Yes| O{Deadline passed?}
    O -->|Yes| P[Disable Resubmit and explain deadline rule]
    P --> Q([Keep existing submission])
    O -->|No| R[Select Resubmit]
    R --> S[Choose replacement file and optional comment]
    S --> T[Replace submission]
    T --> U([Updated submission saved])

    N --> V[Facilitator reviews and grades]
    U --> V
    V --> W[Trainee views score and feedback]
```

## 7. Trainee — daily learning and support journey

```mermaid
flowchart TD
    A([Trainee portal]) --> B[Review My Progress dashboard]
    B --> C{Choose need}

    C -->|Cohort information| D[Open My Batch]
    D --> E[See current batch, facilitator, and other trainees]

    C -->|Upcoming learning| F[Open Sessions and Calendar]
    F --> G[Review session date, time, facilitator, and related assignment]
    G --> H{Completed session has feedback form?}
    H -->|Yes| I[Open and submit session feedback]
    H -->|No| J[See feedback not available]
    I --> K[Status changes to Feedback Submitted]

    C -->|Study material| L[Open Learning Repository]
    L --> M[Search or sort verified resources]
    M --> N[Preview or download resource]

    C -->|Updates| O[Open Announcements]
    O --> P[Read batch or role-relevant announcements]

    C -->|Help| Q[Open Facilitators]
    Q --> R[Search assigned facilitator contacts]
    R --> S[Select Contact]
    S --> T([Open email client])

    C -->|Facilitator feedback| U[Open My Session Feedback]
    U --> V[Choose facilitator, category, rating, and comment]
    V --> W[Submit feedback]
    W --> X[View feedback submitted and received]
```

## 8. Session-feedback lifecycle across roles

```mermaid
sequenceDiagram
    actor A as Admin or Facilitator
    participant P as Trainee Portal
    participant F as External Feedback Form
    participant S as Portal Feedback Status

    A->>S: Attach form URL to a session
    A->>S: Choose audience: Trainees, Facilitators, or Both
    S-->>P: Show form only to eligible user after completed session
    P->>F: Open feedback form
    P->>S: Record feedback submission
    S-->>P: Display Feedback Submitted
    A->>S: Review feedback reporting and completion state
```

## 9. Shared account and exit flow

```mermaid
flowchart TD
    A([Any signed-in role]) --> B{User action}
    B -->|Notifications| C[Open notification panel]
    C --> D[Read or act on relevant notification]
    B -->|Profile| E[Open profile menu]
    E --> F[Open Account Settings]
    F --> G[Update name, email, phone, location, avatar, or password]
    G --> H{Inputs valid?}
    H -->|No| I[Show validation error]
    I --> G
    H -->|Yes| J[Save profile and security changes]
    J --> K([Return to role dashboard])
    B -->|Sign out| L[Clear session]
    L --> M([Return to sign-in page])
```

## 10. Role-access summary

| Capability | Admin | Facilitator | Trainee |
|---|:---:|:---:|:---:|
| View system-wide analytics | Yes | No | No |
| Create batches from training plans | Yes | No | No |
| Manage training-plan templates | Yes | No | No |
| View assigned/enrolled batches | All batches | Own batches | Enrolled batches |
| Create and manage assignments | Yes | Own batches | No |
| Submit assignments | No | No | Own assignments |
| Grade submissions | Yes | Own batches | No |
| Manage sessions and attendance | Yes | Own batches | View only |
| Attach session-feedback forms | Yes | Own sessions | No |
| Submit eligible session feedback | If applicable | Yes | Yes |
| Publish announcements/resources | Global | Own batches | View/download |
| Export reports and inspect audit logs | Yes | Limited reports | No |
| Update own account settings | Yes | Yes | Yes |

## 11. Important rules represented in these flows

- The portal has exactly two standard training plans: **BA BTech** and **BA MBA**.
- Batch creation generates an editable batch-specific copy of the selected plan.
- Weekends are skipped when the system generates the training schedule.
- Trainer assignment during batch creation is optional.
- Facilitators are limited to batches assigned to them; trainees are limited to batches in which they are enrolled.
- Session-feedback visibility depends on the selected audience and the user's relationship to the batch.
- A trainee may make a late first assignment submission, but cannot replace an existing submission after the deadline.
- Only verified resources are exposed to trainees.
- Demo mode uses sample data and does not represent a persistent production database.

