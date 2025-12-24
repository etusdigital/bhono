#!/usr/bin/env python3
"""
Repository Structure Analyzer
Discovers microservices and creates initial inventory
"""

import os
import json
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse

class ServiceDiscoverer:
    """Discovers services in a repository"""
    
    # Service markers by language
    SERVICE_MARKERS = {
        'node': ['package.json', 'yarn.lock', 'package-lock.json'],
        'java': ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        'python': ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py'],
        'go': ['go.mod', 'go.sum'],
        'dotnet': ['*.csproj', '*.fsproj', '*.vbproj'],
        'ruby': ['Gemfile', 'Gemfile.lock'],
        'rust': ['Cargo.toml'],
        'php': ['composer.json']
    }
    
    # Deployment markers
    DEPLOY_MARKERS = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
                      'deployment.yaml', 'deployment.yml', 'helm/', 'charts/']
    
    # Common service directories
    SERVICE_DIRS = ['services', 'apps', 'packages', 'cmd', 'src', 'api']
    
    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()
        self.services = []
        self.monorepo_markers = ['lerna.json', 'nx.json', 'rush.json', 
                                  'pnpm-workspace.yaml', '.yarn/workspaces']
    
    def is_monorepo(self) -> Tuple[bool, str]:
        """Check if this is a monorepo"""
        for marker in self.monorepo_markers:
            if (self.root_path / marker).exists():
                return True, marker
        
        # Check for yarn workspaces
        pkg_file = self.root_path / 'package.json'
        if pkg_file.exists():
            try:
                with open(pkg_file) as f:
                    data = json.load(f)
                    if 'workspaces' in data:
                        return True, 'yarn workspaces'
            except:
                pass
        
        return False, ''
    
    def detect_language(self, path: Path) -> Optional[str]:
        """Detect the primary language of a service"""
        for lang, markers in self.SERVICE_MARKERS.items():
            for marker in markers:
                if '*' in marker:
                    if list(path.glob(marker)):
                        return lang
                elif (path / marker).exists():
                    return lang
        return None
    
    def get_framework(self, path: Path, language: str) -> str:
        """Detect framework based on dependencies"""
        frameworks = []
        
        if language == 'node':
            pkg_file = path / 'package.json'
            if pkg_file.exists():
                try:
                    with open(pkg_file) as f:
                        data = json.load(f)
                        deps = {**data.get('dependencies', {}), 
                                **data.get('devDependencies', {})}
                        
                        if 'express' in deps:
                            frameworks.append('Express')
                        if '@nestjs/core' in deps:
                            frameworks.append('NestJS')
                        if 'fastify' in deps:
                            frameworks.append('Fastify')
                        if 'next' in deps:
                            frameworks.append('Next.js')
                        if 'koa' in deps:
                            frameworks.append('Koa')
                except:
                    pass
        
        elif language == 'python':
            req_files = ['requirements.txt', 'Pipfile', 'pyproject.toml']
            for req_file in req_files:
                if (path / req_file).exists():
                    try:
                        content = (path / req_file).read_text().lower()
                        if 'flask' in content:
                            frameworks.append('Flask')
                        if 'fastapi' in content:
                            frameworks.append('FastAPI')
                        if 'django' in content:
                            frameworks.append('Django')
                    except:
                        pass
        
        elif language == 'java':
            build_files = ['pom.xml', 'build.gradle']
            for build_file in build_files:
                if (path / build_file).exists():
                    try:
                        content = (path / build_file).read_text().lower()
                        if 'spring-boot' in content:
                            frameworks.append('Spring Boot')
                        if 'quarkus' in content:
                            frameworks.append('Quarkus')
                        if 'micronaut' in content:
                            frameworks.append('Micronaut')
                    except:
                        pass
        
        return ', '.join(frameworks) if frameworks else 'Unknown'
    
    def is_deployable(self, path: Path) -> bool:
        """Check if this is a deployable service"""
        for marker in self.DEPLOY_MARKERS:
            if '*' in marker or '/' in marker:
                if (path / marker.replace('/', '')).exists():
                    return True
            elif (path / marker).exists():
                return True
        return False
    
    def get_service_name(self, path: Path) -> str:
        """Extract service name from path or config"""
        # Try package.json name
        pkg_file = path / 'package.json'
        if pkg_file.exists():
            try:
                with open(pkg_file) as f:
                    data = json.load(f)
                    if 'name' in data:
                        return data['name']
            except:
                pass
        
        # Use directory name
        return path.name
    
    def analyze_service(self, path: Path) -> Dict:
        """Analyze a single service"""
        relative_path = path.relative_to(self.root_path)
        language = self.detect_language(path)
        
        return {
            'name': self.get_service_name(path),
            'path': str(relative_path),
            'language': language or 'Unknown',
            'framework': self.get_framework(path, language) if language else 'Unknown',
            'deployable': self.is_deployable(path),
            'confidence': 'HIGH' if language and self.is_deployable(path) else 'MEDIUM',
            'has_tests': any(path.glob('**/test*')) or any(path.glob('**/*test*')),
            'has_dockerfile': (path / 'Dockerfile').exists(),
            'has_k8s': any(path.glob('**/deployment.yaml')) or any(path.glob('**/k8s/')),
        }
    
    def discover_services(self) -> List[Dict]:
        """Discover all services in the repository"""
        services = []
        visited = set()
        
        # Check if monorepo
        is_mono, marker_type = self.is_monorepo()
        
        if is_mono:
            print(f"Detected monorepo ({marker_type})")
            
            # Look for services in common directories
            for service_dir in self.SERVICE_DIRS:
                service_path = self.root_path / service_dir
                if service_path.exists() and service_path.is_dir():
                    for child in service_path.iterdir():
                        if child.is_dir() and child not in visited:
                            visited.add(child)
                            if self.detect_language(child) or self.is_deployable(child):
                                services.append(self.analyze_service(child))
        
        # Also check root and immediate subdirectories
        for path in self.root_path.iterdir():
            if path.is_dir() and path.name not in ['.git', 'node_modules', '__pycache__', 'target', 'build', 'dist']:
                if path not in visited:
                    if self.detect_language(path) or self.is_deployable(path):
                        services.append(self.analyze_service(path))
        
        # Check if root itself is a service
        if not services and (self.detect_language(self.root_path) or self.is_deployable(self.root_path)):
            services.append(self.analyze_service(self.root_path))
        
        return services
    
    def generate_inventory(self) -> Dict:
        """Generate complete inventory"""
        services = self.discover_services()
        is_mono, marker = self.is_monorepo()
        
        return {
            'repository_type': 'monorepo' if is_mono else 'multi-service',
            'monorepo_tool': marker if is_mono else None,
            'services_count': len(services),
            'services': services,
            'languages': list(set(s['language'] for s in services if s['language'] != 'Unknown')),
            'frameworks': list(set(s['framework'] for s in services if s['framework'] != 'Unknown')),
            'deployable_services': sum(1 for s in services if s['deployable']),
            'services_with_tests': sum(1 for s in services if s['has_tests']),
        }

def main():
    parser = argparse.ArgumentParser(description='Analyze repository structure for microservices')
    parser.add_argument('path', nargs='?', default='.', help='Repository path to analyze')
    parser.add_argument('--output', '-o', help='Output file (default: stdout)')
    parser.add_argument('--format', '-f', choices=['json', 'markdown'], default='markdown',
                        help='Output format')
    
    args = parser.parse_args()
    
    discoverer = ServiceDiscoverer(args.path)
    inventory = discoverer.generate_inventory()
    
    if args.format == 'json':
        output = json.dumps(inventory, indent=2)
    else:
        # Markdown format
        output = f"""# Microservices Inventory

## Repository Analysis
- **Type**: {inventory['repository_type']}
- **Monorepo Tool**: {inventory['monorepo_tool'] or 'N/A'}
- **Total Services**: {inventory['services_count']}
- **Deployable Services**: {inventory['deployable_services']}
- **Services with Tests**: {inventory['services_with_tests']}
- **Languages**: {', '.join(inventory['languages'])}
- **Frameworks**: {', '.join(inventory['frameworks'])}

## Services Discovered

| Service | Path | Language | Framework | Deployable | Tests | Confidence |
|---------|------|----------|-----------|------------|-------|------------|
"""
        for service in inventory['services']:
            output += f"| {service['name']} | `{service['path']}` | {service['language']} | {service['framework']} | {'✓' if service['deployable'] else '✗'} | {'✓' if service['has_tests'] else '✗'} | {service['confidence']} |\n"
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Inventory written to {args.output}")
    else:
        print(output)

if __name__ == '__main__':
    main()
