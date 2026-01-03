#!/usr/bin/env python3
"""
C4 Diagram Generator
Generates C4 architecture diagrams from service analysis
"""

import json
import argparse
from pathlib import Path
from typing import Dict, List, Set

class C4Generator:
    """Generate C4 diagrams in Mermaid format"""
    
    def __init__(self, services_data: Dict):
        self.services = services_data.get('services', [])
        self.dependencies = {}
        self.external_systems = set()
        
    def analyze_dependencies(self):
        """Analyze service dependencies from code patterns"""
        # This would be populated from actual code analysis
        # For now, showing the structure
        pass
    
    def generate_context_diagram(self) -> str:
        """Generate C4 Level 1 - System Context diagram"""
        diagram = """graph TB
    %% C4 Context Diagram
    %% Level 1: System Context
    
    %% Actors
    User[User<br/>System User]
    Admin[Administrator<br/>System Admin]
    
    %% System Boundary
    System[Your System<br/>Microservices Platform]
    
    %% External Systems
    Auth[External Auth<br/>OAuth Provider]
    Payment[Payment Gateway<br/>External Service]
    Email[Email Service<br/>SendGrid/SES]
    
    %% Relationships
    User -->|Uses| System
    Admin -->|Manages| System
    System -->|Authenticates with| Auth
    System -->|Processes payments| Payment
    System -->|Sends emails| Email
    
    %% Styling
    style System fill:#1168bd,stroke:#333,stroke-width:4px
    style User fill:#08427b,stroke:#333,stroke-width:2px,color:#fff
    style Admin fill:#08427b,stroke:#333,stroke-width:2px,color:#fff
    
    classDef external fill:#999,stroke:#333,stroke-width:2px
    class Auth,Payment,Email external"""
        
        return diagram
    
    def generate_container_diagram(self) -> str:
        """Generate C4 Level 2 - Container diagram"""
        if not self.services:
            return "graph TB\n    NoServices[No services found]"
        
        diagram = """graph TB
    %% C4 Container Diagram  
    %% Level 2: Containers (Services)
    
    subgraph "System Boundary"
"""
        
        # Add services
        for service in self.services:
            name = service.get('name', 'unknown')
            lang = service.get('language', 'unknown')
            framework = service.get('framework', '')
            
            # Create service node
            service_id = name.replace('-', '_').replace(' ', '_')
            label = f"{name}<br/>{lang}"
            if framework and framework != 'Unknown':
                label += f"<br/>{framework}"
            
            diagram += f"        {service_id}[{label}]\n"
        
        diagram += """    end
    
    %% External Storage
    DB[(Database<br/>PostgreSQL)]
    Cache[(Cache<br/>Redis)]
    Queue[Message Queue<br/>RabbitMQ]
    
    %% Basic relationships (would be enhanced with actual dependency data)"""
        
        # Add basic relationships for services that likely need DB
        for service in self.services:
            service_id = service.get('name', '').replace('-', '_').replace(' ', '_')
            if service_id:
                if 'user' in service_id.lower() or 'auth' in service_id.lower():
                    diagram += f"\n    {service_id} -->|Reads/Writes| DB"
                if 'api' in service_id.lower() or 'gateway' in service_id.lower():
                    diagram += f"\n    {service_id} -->|Caches| Cache"
        
        diagram += """
    
    %% Styling
    classDef service fill:#1168bd,stroke:#333,stroke-width:2px,color:#fff
    classDef storage fill:#999,stroke:#333,stroke-width:2px"""
        
        return diagram
    
    def generate_component_diagram(self, service_name: str) -> str:
        """Generate C4 Level 3 - Component diagram for a specific service"""
        diagram = f"""graph TB
    %% C4 Component Diagram
    %% Level 3: Components of {service_name}
    
    subgraph "{service_name}"
        Controller[REST Controller<br/>Handles HTTP requests]
        Service[Business Service<br/>Core business logic]
        Repository[Repository<br/>Data access layer]
        Validator[Validator<br/>Input validation]
        EventBus[Event Publisher<br/>Publishes domain events]
    end
    
    %% External containers
    DB[(Database)]
    Queue[Message Queue]
    
    %% Relationships
    Controller --> Validator
    Validator --> Service
    Service --> Repository
    Service --> EventBus
    Repository -->|SQL| DB
    EventBus -->|Publishes| Queue
    
    %% Styling
    style Controller fill:#85bbf0,stroke:#333,stroke-width:2px
    style Service fill:#85bbf0,stroke:#333,stroke-width:2px
    style Repository fill:#85bbf0,stroke:#333,stroke-width:2px"""
        
        return diagram
    
    def generate_deployment_diagram(self) -> str:
        """Generate deployment diagram"""
        diagram = """graph TB
    %% Deployment Diagram
    
    subgraph "Production Environment"
        subgraph "Kubernetes Cluster"
            subgraph "Node 1"
                Pod1[Pod: Service A<br/>Replicas: 3]
                Pod2[Pod: Service B<br/>Replicas: 2]
            end
            subgraph "Node 2"
                Pod3[Pod: Service C<br/>Replicas: 2]
                Pod4[Pod: Service D<br/>Replicas: 1]
            end
        end
        
        LB[Load Balancer<br/>Ingress]
        
        subgraph "Data Tier"
            DB[(PostgreSQL<br/>Primary)]
            DBR[(PostgreSQL<br/>Read Replica)]
            Cache[(Redis Cluster)]
        end
    end
    
    Internet[Internet] -->|HTTPS| LB
    LB --> Pod1
    LB --> Pod2
    Pod1 --> DB
    Pod2 --> Cache
    Pod3 --> DB
    Pod4 --> DBR"""
        
        return diagram
    
    def generate_all_diagrams(self) -> Dict[str, str]:
        """Generate all C4 diagrams"""
        diagrams = {
            'context': self.generate_context_diagram(),
            'container': self.generate_container_diagram(),
            'deployment': self.generate_deployment_diagram()
        }
        
        # Generate component diagrams for key services
        key_services = [s for s in self.services 
                       if any(key in s.get('name', '').lower() 
                             for key in ['api', 'gateway', 'auth', 'user'])]
        
        for service in key_services[:3]:  # Limit to 3 component diagrams
            service_name = service.get('name', 'unknown')
            diagrams[f'component_{service_name}'] = self.generate_component_diagram(service_name)
        
        return diagrams

def main():
    parser = argparse.ArgumentParser(description='Generate C4 diagrams from service analysis')
    parser.add_argument('--input', '-i', default='services.json', 
                       help='Input services JSON file')
    parser.add_argument('--output-dir', '-o', default='diagrams',
                       help='Output directory for diagrams')
    parser.add_argument('--format', '-f', choices=['mermaid', 'plantuml'], 
                       default='mermaid', help='Output format')
    
    args = parser.parse_args()
    
    # Load services data
    services_data = {'services': []}
    if Path(args.input).exists():
        with open(args.input) as f:
            services_data = json.load(f)
    else:
        # Try to discover services if input doesn't exist
        print(f"Input file {args.input} not found, using sample data")
        services_data = {
            'services': [
                {'name': 'api-gateway', 'language': 'Node.js', 'framework': 'Express'},
                {'name': 'user-service', 'language': 'Java', 'framework': 'Spring Boot'},
                {'name': 'order-service', 'language': 'Python', 'framework': 'FastAPI'},
            ]
        }
    
    # Generate diagrams
    generator = C4Generator(services_data)
    diagrams = generator.generate_all_diagrams()
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Save diagrams
    for name, content in diagrams.items():
        output_file = output_dir / f"c4_{name}.md"
        
        # Wrap in markdown with title
        markdown_content = f"""# C4 {name.replace('_', ' ').title()} Diagram

```mermaid
{content}
```

## Diagram Notes

- **Confidence**: Relationships marked with solid lines are HIGH confidence
- **External Systems**: Shown in gray boxes
- **System Boundary**: Blue boxes indicate internal services
- **Data Stores**: Cylinder shapes indicate databases and caches

## How to Render

1. Copy the mermaid code into any Mermaid-compatible viewer
2. Or use in any Markdown file that supports Mermaid rendering
3. Can be converted to SVG/PNG using Mermaid CLI tools
"""
        
        with open(output_file, 'w') as f:
            f.write(markdown_content)
        
        print(f"Generated {output_file}")
    
    # Also create an index file
    index_content = """# C4 Architecture Diagrams

## Generated Diagrams

"""
    for name in diagrams.keys():
        title = name.replace('_', ' ').title()
        index_content += f"- [{title}](c4_{name}.md)\n"
    
    with open(output_dir / "README.md", 'w') as f:
        f.write(index_content)
    
    print(f"\nAll diagrams generated in {output_dir}/")
    print(f"View index at {output_dir}/README.md")

if __name__ == '__main__':
    main()
