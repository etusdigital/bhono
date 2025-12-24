# C4 Model Templates

## Overview
The C4 model provides a hierarchical way to describe software architecture using Context, Container, Component, and Code diagrams.

## System Context Diagram (Level 1)

### Mermaid Template
```mermaid
graph TB
    User[User]
    System[Your System]
    ExtSystem1[External System 1]
    ExtSystem2[External System 2]
    
    User -->|Uses| System
    System -->|Sends data to| ExtSystem1
    System -->|Gets data from| ExtSystem2
    
    style System fill:#1168bd,stroke:#333,stroke-width:4px
    style User fill:#08427b,stroke:#333,stroke-width:2px,color:#fff
```

### PlantUML Template
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(user, "User", "A user of the system")
System(system, "Your System", "Description of your system")
System_Ext(ext1, "External System 1", "Description")
System_Ext(ext2, "External System 2", "Description")

Rel(user, system, "Uses")
Rel(system, ext1, "Sends data to")
Rel(system, ext2, "Gets data from")
@enduml
```

## Container Diagram (Level 2)

### Mermaid Template
```mermaid
graph TB
    subgraph "Your System"
        WebApp[Web Application<br/>React]
        API[API Gateway<br/>Node.js]
        AuthService[Auth Service<br/>Node.js]
        UserService[User Service<br/>Java Spring]
        OrderService[Order Service<br/>Python FastAPI]
        DB1[(User DB<br/>PostgreSQL)]
        DB2[(Order DB<br/>MongoDB)]
        Queue[Message Queue<br/>RabbitMQ]
    end
    
    User[User]
    
    User -->|HTTPS| WebApp
    WebApp -->|REST/JSON| API
    API -->|REST| AuthService
    API -->|REST| UserService
    API -->|REST| OrderService
    UserService -->|SQL| DB1
    OrderService -->|NoSQL| DB2
    OrderService -->|Publish| Queue
    UserService -->|Subscribe| Queue
```

### PlantUML Template
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

Person(user, "User")
System_Boundary(system, "Your System") {
    Container(webapp, "Web Application", "React", "Provides UI")
    Container(api, "API Gateway", "Node.js", "Routes requests")
    Container(auth, "Auth Service", "Node.js", "Authentication")
    Container(userservice, "User Service", "Java Spring", "User management")
    Container(orderservice, "Order Service", "Python", "Order processing")
    ContainerDb(userdb, "User Database", "PostgreSQL", "User data")
    ContainerDb(orderdb, "Order Database", "MongoDB", "Order data")
    ContainerQueue(queue, "Message Queue", "RabbitMQ", "Async messaging")
}

Rel(user, webapp, "Uses", "HTTPS")
Rel(webapp, api, "Makes API calls", "REST/JSON")
Rel(api, auth, "Authenticates", "REST")
Rel(api, userservice, "User operations", "REST")
Rel(api, orderservice, "Order operations", "REST")
Rel(userservice, userdb, "Reads/Writes", "SQL")
Rel(orderservice, orderdb, "Reads/Writes", "NoSQL")
Rel(orderservice, queue, "Publishes events")
Rel(userservice, queue, "Subscribes to events")
@enduml
```

## Component Diagram (Level 3)

### Mermaid Template
```mermaid
graph TB
    subgraph "User Service"
        Controller[REST Controller]
        Service[User Service]
        Repository[User Repository]
        EventPublisher[Event Publisher]
        SecurityFilter[Security Filter]
    end
    
    API[API Gateway]
    DB[(PostgreSQL)]
    Queue[RabbitMQ]
    
    API -->|REST| Controller
    Controller --> SecurityFilter
    SecurityFilter --> Service
    Service --> Repository
    Service --> EventPublisher
    Repository -->|SQL| DB
    EventPublisher -->|AMQP| Queue
```

## Sequence Diagram Template

### Mermaid Template
```mermaid
sequenceDiagram
    participant User
    participant WebApp
    participant API Gateway
    participant Auth Service
    participant User Service
    participant Database
    
    User->>WebApp: Login Request
    WebApp->>API Gateway: POST /auth/login
    API Gateway->>Auth Service: Validate Credentials
    Auth Service->>Database: Query User
    Database-->>Auth Service: User Data
    Auth Service-->>API Gateway: JWT Token
    API Gateway-->>WebApp: Login Response
    WebApp-->>User: Show Dashboard
```

## Data Flow Diagram Template

### Mermaid Template
```mermaid
graph LR
    Source[Data Source]
    Ingestion[Ingestion Service]
    Processing[Processing Service]
    Storage[(Data Lake)]
    Analytics[Analytics Service]
    Dashboard[Dashboard]
    
    Source -->|Raw Data| Ingestion
    Ingestion -->|Validated Data| Processing
    Processing -->|Transformed Data| Storage
    Storage -->|Query| Analytics
    Analytics -->|Aggregated Data| Dashboard
```

## Event Flow Diagram Template

### Mermaid Template
```mermaid
graph TB
    OrderService[Order Service]
    UserService[User Service]
    InventoryService[Inventory Service]
    NotificationService[Notification Service]
    
    OrderCreated{Order Created Event}
    PaymentProcessed{Payment Processed Event}
    
    OrderService -->|Publishes| OrderCreated
    OrderCreated -->|Subscribes| UserService
    OrderCreated -->|Subscribes| InventoryService
    OrderCreated -->|Subscribes| NotificationService
    
    OrderService -->|Publishes| PaymentProcessed
    PaymentProcessed -->|Subscribes| NotificationService
    
    style OrderCreated fill:#f9f,stroke:#333,stroke-width:2px
    style PaymentProcessed fill:#f9f,stroke:#333,stroke-width:2px
```

## Dependency Matrix Template

### Markdown Table
```markdown
| Service | User Service | Order Service | Auth Service | Notification | Database |
|---------|-------------|---------------|--------------|--------------|----------|
| **User Service** | - | HTTP | HTTP | Event | PostgreSQL |
| **Order Service** | HTTP | - | HTTP | Event | MongoDB |
| **Auth Service** | - | - | - | - | PostgreSQL |
| **Notification** | Event | Event | - | - | - |
```

### Mermaid Heatmap Style
```mermaid
graph LR
    subgraph "Service Dependencies"
        US[User Service]
        OS[Order Service]
        AS[Auth Service]
        NS[Notification Service]
    end
    
    US -.->|Weak| OS
    US ==>|Strong| AS
    OS ==>|Strong| AS
    OS -->|Medium| NS
    US -->|Medium| NS
```

## Best Practices

1. **Consistency**: Use the same notation and style across all diagrams
2. **Clarity**: Label all connections with protocols/formats
3. **Confidence**: Mark uncertain connections with dashed lines
4. **Versioning**: Include API versions where relevant
5. **Legend**: Add a legend for symbols and confidence levels

## Confidence Notation

- **Solid lines**: HIGH confidence (verified in code)
- **Dashed lines**: MEDIUM confidence (inferred)
- **Dotted lines**: LOW confidence (assumed)
- **Red elements**: Critical/High priority
- **Yellow elements**: Warning/Medium priority
- **Green elements**: Healthy/Low priority
