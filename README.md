## Leave Management Engine Architecture

The Leave Management Engine processes leave requests through independent decision engines for eligibility, accrual, and approval. A centralized validation layer incorporates organizational holidays and work-week schedules before producing the final leave decision.

```mermaid
flowchart TB
    R(["Leave Request"])

    subgraph ENGINE["LEAVE MANAGEMENT ENGINE"]
        E["Eligibility Engine"]
        A["Accrual Engine"]
        P["Approval Engine"]
        V["Validation Engine"]
    end

    subgraph CONTEXT["VALIDATION CONTEXT"]
        H["Holiday Calendar"]
        W["Work Week Schedule"]
    end

    D(["Final Decision"])

    R --> E
    R --> A
    R --> P

    E --> V
    A --> V
    P --> V

    V --> H
    V --> W

    H --> D
    W --> D
